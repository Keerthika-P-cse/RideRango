import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pool from '../config/db.js'
import { sendSuccess, sendError } from '../utils/apiResponse.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const UPLOAD_DIR = path.resolve(__dirname, '../../uploads/documents')

// Ensure uploads directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

/**
 * Helper to save base64 image data to disk safely.
 * Returns relative serving URL or original relative path if it's already a URL.
 */
function saveImageLocally(dataUriOrUrl, prefix, customerId, bookingId) {
  if (!dataUriOrUrl || typeof dataUriOrUrl !== 'string') {
    throw new Error('Invalid image data provided.')
  }

  // If already a relative path or sample URL, return as-is
  if (dataUriOrUrl.startsWith('/images/') || dataUriOrUrl.startsWith('http://') || dataUriOrUrl.startsWith('https://')) {
    return dataUriOrUrl
  }

  // Base64 Data URI matching (JPG, JPEG, PNG, SVG)
  const matches = dataUriOrUrl.match(/^data:image\/(jpeg|jpg|png|svg\+xml);base64,(.+)$/i)
  if (!matches) {
    // If not a data URI, check if it's a raw base64 string
    if (dataUriOrUrl.length > 100) {
      const ext = 'png'
      const filename = `dl_c${customerId}_b${bookingId}_${prefix}_${Date.now()}.${ext}`
      const filepath = path.join(UPLOAD_DIR, filename)
      fs.writeFileSync(filepath, Buffer.from(dataUriOrUrl, 'base64'))
      return `/api/v1/documents/file/${filename}`
    }
    throw new Error('Unsupported image format. Allowed: JPG, JPEG, PNG.')
  }

  let ext = matches[1].toLowerCase()
  if (ext === 'jpeg') ext = 'jpg'
  if (ext === 'svg+xml') ext = 'svg'

  const base64Data = matches[2]
  const filename = `dl_c${customerId}_b${bookingId}_${prefix}_${Date.now()}.${ext}`
  const filepath = path.join(UPLOAD_DIR, filename)
  fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'))

  return `/api/v1/documents/file/${filename}`
}

/**
 * 1. Customer Upload Driving Licence (Front & Back)
 */
export const uploadDrivingLicence = async (req, res) => {
  try {
    const customerId = req.customer.id
    const { booking_id, front_image, back_image, document_number } = req.body

    if (!booking_id) {
      return sendError(res, 'Booking reference/ID is required for document submission.', 400)
    }

    if (!front_image || !back_image) {
      return sendError(res, 'Both Front Side and Back Side of the Driving Licence are required.', 400)
    }

    // Verify booking belongs to this customer
    const [bookingRows] = await pool.query(
      'SELECT id, booking_reference FROM bookings WHERE id = ? AND customer_id = ?',
      [booking_id, customerId]
    )

    if (bookingRows.length === 0) {
      return sendError(res, 'Associated booking not found or unauthorized.', 404)
    }

    const bookingRef = bookingRows[0].booking_reference
    const dlNumber = document_number ? String(document_number).trim().toUpperCase() : 'DL-DEMO'

    // Save front and back images safely
    const frontUrl = saveImageLocally(front_image, 'front', customerId, booking_id)
    const backUrl = saveImageLocally(back_image, 'back', customerId, booking_id)

    // Store in customer_documents
    const frontDocNum = `BK-${booking_id}-FRONT`
    const backDocNum = `BK-${booking_id}-BACK`

    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()

      // Delete or replace existing document entries for this booking
      await connection.query(
        `DELETE FROM customer_documents
         WHERE customer_id = ? AND document_number IN (?, ?)`,
        [customerId, frontDocNum, backDocNum]
      )

      // Insert Front Side row
      await connection.query(
        `INSERT INTO customer_documents
         (customer_id, document_type, document_number, file_url, verification_status, created_at, updated_at)
         VALUES (?, 'driving_license', ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [customerId, frontDocNum, frontUrl]
      )

      // Insert Back Side row
      await connection.query(
        `INSERT INTO customer_documents
         (customer_id, document_type, document_number, file_url, verification_status, created_at, updated_at)
         VALUES (?, 'driving_license', ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [customerId, backDocNum, backUrl]
      )

      // Update customer record verification_status to pending
      await connection.query(
        `UPDATE customers
         SET verification_status = 'pending',
             driving_license_number = COALESCE(?, driving_license_number)
         WHERE id = ?`,
        [dlNumber !== 'DL-DEMO' ? dlNumber : null, customerId]
      )

      await connection.commit()

      return sendSuccess(res, 'Driving licence submitted successfully for verification.', {
        booking_id,
        booking_reference: bookingRef,
        status: 'pending',
        front_url: frontUrl,
        back_url: backUrl,
        submitted_at: new Date().toISOString()
      }, 201)

    } catch (txErr) {
      await connection.rollback()
      throw txErr
    } finally {
      connection.release()
    }

  } catch (err) {
    console.error('uploadDrivingLicence error:', err)
    return sendError(res, err.message || 'Failed to submit driving licence documents.', 500)
  }
}

/**
 * 2. Get Document Status for Customer Booking
 */
export const getDocumentStatus = async (req, res) => {
  try {
    const customerId = req.customer.id
    const { bookingId } = req.params

    const frontDocNum = `BK-${bookingId}-FRONT`
    const backDocNum = `BK-${bookingId}-BACK`

    const [rows] = await pool.query(
      `SELECT id, customer_id, document_number, file_url, verification_status, rejection_reason, created_at, updated_at
       FROM customer_documents
       WHERE customer_id = ? AND document_number IN (?, ?)
       ORDER BY id ASC`,
      [customerId, frontDocNum, backDocNum]
    )

    if (rows.length === 0) {
      return sendSuccess(res, 'Document status retrieved.', {
        status: 'not_submitted',
        booking_id: parseInt(bookingId, 10),
        front_url: null,
        back_url: null,
        rejection_reason: null
      })
    }

    const frontDoc = rows.find(r => r.document_number.endsWith('-FRONT')) || rows[0]
    const backDoc = rows.find(r => r.document_number.endsWith('-BACK')) || rows[1] || null

    // Determine normalized status: not_submitted | pending | verified | rejected
    const rawStatus = frontDoc ? frontDoc.verification_status : 'not_submitted'
    // UI displays 'accepted' for 'verified'
    const displayStatus = rawStatus === 'verified' ? 'accepted' : rawStatus

    return sendSuccess(res, 'Document status retrieved.', {
      status: displayStatus,
      raw_status: rawStatus,
      booking_id: parseInt(bookingId, 10),
      front_url: frontDoc?.file_url || null,
      back_url: backDoc?.file_url || null,
      rejection_reason: frontDoc?.rejection_reason || null,
      submitted_at: frontDoc?.created_at,
      updated_at: frontDoc?.updated_at
    })

  } catch (err) {
    console.error('getDocumentStatus error:', err)
    return sendError(res, 'Failed to retrieve document status.', 500)
  }
}

/**
 * 3. Staff/Admin: List All Driving Licence Submissions
 */
export const getAdminDocuments = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT cd.id, cd.customer_id, cd.document_number, cd.file_url, cd.verification_status,
              cd.rejection_reason, cd.created_at, cd.updated_at,
              c.first_name, c.last_name, c.email, c.phone, c.driving_license_number,
              b.id as booking_id, b.booking_reference, b.booking_status
       FROM customer_documents cd
       INNER JOIN customers c ON cd.customer_id = c.id
       LEFT JOIN bookings b ON b.customer_id = c.id AND (cd.document_number LIKE CONCAT('BK-', b.id, '-%'))
       WHERE cd.document_type = 'driving_license'
       ORDER BY cd.created_at DESC`
    )

    // Group rows by booking
    const groupedMap = new Map()

    for (const row of rows) {
      // Extract bookingId from document_number: 'BK-<id>-FRONT'
      let bId = row.booking_id
      if (!bId) {
        const m = String(row.document_number || '').match(/^BK-(\d+)-/i)
        if (m) bId = parseInt(m[1], 10)
      }
      const key = `${row.customer_id}_${bId || 'general'}`

      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          customer_id: row.customer_id,
          customer_name: `${row.first_name} ${row.last_name}`,
          email: row.email,
          phone: row.phone,
          driving_license_number: row.driving_license_number,
          booking_id: bId,
          booking_reference: row.booking_reference || (bId ? `RR-BK-${bId}` : 'N/A'),
          booking_status: row.booking_status || 'N/A',
          status: row.verification_status === 'verified' ? 'accepted' : row.verification_status,
          raw_status: row.verification_status,
          rejection_reason: row.rejection_reason,
          front_url: null,
          back_url: null,
          submitted_at: row.created_at,
          updated_at: row.updated_at
        })
      }

      const item = groupedMap.get(key)
      if (String(row.document_number || '').endsWith('-FRONT')) {
        item.front_url = row.file_url
      } else if (String(row.document_number || '').endsWith('-BACK')) {
        item.back_url = row.file_url
      } else if (!item.front_url) {
        item.front_url = row.file_url
      }
    }

    const result = Array.from(groupedMap.values())
    return sendSuccess(res, 'Document verification submissions retrieved.', result)

  } catch (err) {
    console.error('getAdminDocuments error:', err)
    return sendError(res, 'Failed to retrieve document verification list.', 500)
  }
}

/**
 * 4. Staff/Admin: Accept or Reject Driving Licence
 */
export const verifyAdminDocument = async (req, res) => {
  try {
    const staffId = req.staff.id
    const { bookingId } = req.params
    const { action, reason } = req.body

    const normalizedAction = String(action || '').toLowerCase().trim()
    if (!['accept', 'reject'].includes(normalizedAction)) {
      return sendError(res, "Action must be either 'accept' or 'reject'.", 400)
    }

    const frontDocNum = `BK-${bookingId}-FRONT`
    const backDocNum = `BK-${bookingId}-BACK`

    const [existing] = await pool.query(
      `SELECT id, customer_id, document_number, verification_status
       FROM customer_documents
       WHERE document_number IN (?, ?)`,
      [frontDocNum, backDocNum]
    )

    if (existing.length === 0) {
      return sendError(res, 'No submitted documents found for this booking.', 404)
    }

    const customerId = existing[0].customer_id
    const newDbStatus = normalizedAction === 'accept' ? 'verified' : 'rejected'
    const rejectionReason = normalizedAction === 'reject' ? (reason?.trim() || 'Document image unclear or unreadable.') : null

    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()

      // Update both document rows
      await connection.query(
        `UPDATE customer_documents
         SET verification_status = ?,
             verified_by_staff_id = ?,
             verified_at = CURRENT_TIMESTAMP,
             rejection_reason = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE document_number IN (?, ?)`,
        [newDbStatus, staffId, rejectionReason, frontDocNum, backDocNum]
      )

      // Update customer profile verification status
      await connection.query(
        `UPDATE customers
         SET verification_status = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [newDbStatus, customerId]
      )

      await connection.commit()

      const displayStatus = newDbStatus === 'verified' ? 'accepted' : 'rejected'
      return sendSuccess(res, `Driving licence has been ${displayStatus}.`, {
        booking_id: parseInt(bookingId, 10),
        customer_id: customerId,
        status: displayStatus,
        raw_status: newDbStatus,
        rejection_reason: rejectionReason,
        verified_at: new Date().toISOString()
      })

    } catch (txErr) {
      await connection.rollback()
      throw txErr
    } finally {
      connection.release()
    }

  } catch (err) {
    console.error('verifyAdminDocument error:', err)
    return sendError(res, 'Failed to update document verification status.', 500)
  }
}

/**
 * 5. Serve Document File
 */
export const serveDocumentFile = (req, res) => {
  try {
    const { filename } = req.params
    // Basic path traversal prevention
    const sanitized = path.basename(filename)
    const filepath = path.join(UPLOAD_DIR, sanitized)

    if (!fs.existsSync(filepath)) {
      return res.status(404).send('Document image file not found.')
    }

    return res.sendFile(filepath)
  } catch (err) {
    console.error('serveDocumentFile error:', err)
    return res.status(500).send('Error serving file.')
  }
}
