import pool from '../config/db.js'
import { sendSuccess, sendError } from '../utils/apiResponse.js'

let tableInitialized = false

/**
 * Helper to ensure the rental_handover table exists in the database.
 * Fully idempotent across MySQL and TiDB Cloud.
 */
export async function ensureHandoverTable() {
  if (tableInitialized) return
  try {
    const ddl = `
      CREATE TABLE IF NOT EXISTS rental_handover (
        id INT AUTO_INCREMENT PRIMARY KEY,
        booking_id INT NOT NULL UNIQUE,
        staff_id INT NOT NULL,
        handover_datetime DATETIME NOT NULL,
        odometer_reading INT NOT NULL,
        fuel_level_percent INT NOT NULL CHECK (fuel_level_percent BETWEEN 0 AND 100),
        initial_damages_notes TEXT DEFAULT NULL,
        customer_signature_confirmed BOOLEAN NOT NULL DEFAULT TRUE,
        handover_notes TEXT DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_handover_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT,
        CONSTRAINT fk_handover_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE RESTRICT,
        INDEX idx_handover_booking (booking_id),
        INDEX idx_handover_staff (staff_id)
      ) ENGINE=InnoDB;
    `
    await pool.query(ddl)
    tableInitialized = true
  } catch (err) {
    if (err.code !== 'ER_TABLE_EXISTS_ERROR') {
      console.warn('ensureHandoverTable note:', err.message)
    }
    tableInitialized = true
  }
}

/**
 * Normalize fuel level input (percentage or human label) to integer 0..100
 */
export function normalizeFuelLevel(input) {
  if (input === undefined || input === null || input === '') {
    return { valid: false, error: 'Fuel level is required.' }
  }

  const str = String(input).trim().toLowerCase()
  if (str === 'empty' || str === '0' || str === '0%') return { valid: true, value: 0 }
  if (str === '1/4' || str === '¼' || str === '25' || str === '25%') return { valid: true, value: 25 }
  if (str === '1/2' || str === '½' || str === '50' || str === '50%') return { valid: true, value: 50 }
  if (str === '3/4' || str === '¾' || str === '75' || str === '75%') return { valid: true, value: 75 }
  if (str === 'full' || str === '100' || str === '100%') return { valid: true, value: 100 }

  const num = Number(str.replace('%', ''))
  if (!isNaN(num) && num >= 0 && num <= 100) {
    return { valid: true, value: Math.round(num) }
  }

  return {
    valid: false,
    error: 'Invalid fuel level. Allowed values: Empty (0%), ¼ (25%), ½ (50%), ¾ (75%), Full (100%), or a number between 0 and 100.'
  }
}

/**
 * Human-readable fuel display label
 */
export function getFuelLevelDisplay(percent) {
  const p = Math.round(Number(percent))
  if (p === 100) return 'Full (100%)'
  if (p === 75) return '¾ (75%)'
  if (p === 50) return '½ (50%)'
  if (p === 25) return '¼ (25%)'
  if (p === 0) return 'Empty (0%)'
  return `${p}%`
}

/**
 * Helper to ensure a valid staff ID exists
 */
async function resolveStaffId(candidateId, connection) {
  if (candidateId) {
    const [rows] = await connection.query('SELECT id FROM staff WHERE id = ? LIMIT 1', [candidateId])
    if (rows.length > 0) return rows[0].id
  }
  const [firstStaff] = await connection.query('SELECT id FROM staff ORDER BY id ASC LIMIT 1')
  return firstStaff.length > 0 ? firstStaff[0].id : 1
}

/**
 * Record vehicle handover (Admin/Staff only)
 * POST /api/v1/handovers
 */
export const recordVehicleHandover = async (req, res) => {
  await ensureHandoverTable()

  const {
    booking_id,
    odometer_reading,
    fuel_level,
    handover_notes = '',
    handover_datetime
  } = req.body

  if (!booking_id || isNaN(Number(booking_id))) {
    return sendError(res, 'Valid booking ID is required.', 400)
  }

  const odoNum = Number(odometer_reading)
  if (isNaN(odoNum) || odoNum < 0) {
    return sendError(res, 'Starting odometer reading must be a valid non-negative number.', 400)
  }

  const fuelResult = normalizeFuelLevel(fuel_level)
  if (!fuelResult.valid) {
    return sendError(res, fuelResult.error, 400)
  }

  const staffIdFromAuth = req.staff?.id || req.user?.id || null

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    // 1. Look up vehicle_id and booking info
    const [bookingRows] = await connection.query(
      `SELECT id, booking_reference, customer_id, vehicle_id, booking_status, start_date, end_date
       FROM bookings
       WHERE id = ?
       FOR UPDATE`,
      [booking_id]
    )

    if (bookingRows.length === 0) {
      await connection.rollback()
      return sendError(res, 'Booking not found.', 404)
    }

    const booking = bookingRows[0]
    const vehicleId = booking.vehicle_id

    // 2. Lock vehicle row
    const [vehicleRows] = await connection.query(
      `SELECT id, make, model, registration_number, availability_status, is_active
       FROM vehicles
       WHERE id = ?
       FOR UPDATE`,
      [vehicleId]
    )

    if (vehicleRows.length === 0) {
      await connection.rollback()
      return sendError(res, 'Associated vehicle not found.', 404)
    }

    const vehicle = vehicleRows[0]

    // 3. Prevent duplicate handover
    const [existingHandover] = await connection.query(
      `SELECT id, handover_datetime, odometer_reading, fuel_level_percent, handover_notes
       FROM rental_handover
       WHERE booking_id = ?
       FOR UPDATE`,
      [booking_id]
    )

    if (existingHandover.length > 0) {
      await connection.rollback()
      return sendError(res, 'Vehicle handover has already been completed for this booking.', 409)
    }

    // 4. Validate booking status eligibility
    if (booking.booking_status !== 'confirmed') {
      await connection.rollback()
      let detail = `Vehicle handover can only be recorded for confirmed bookings (current status: '${booking.booking_status}').`
      if (booking.booking_status === 'pending') {
        detail = 'Cannot hand over vehicle. Booking must be confirmed and paid first.'
      } else if (booking.booking_status === 'active') {
        detail = 'Vehicle handover has already been processed for this booking.'
      } else if (booking.booking_status === 'completed') {
        detail = 'Cannot hand over vehicle for a completed booking.'
      } else if (booking.booking_status === 'cancelled') {
        detail = 'Cannot hand over vehicle for a cancelled booking.'
      }
      return sendError(res, detail, 400)
    }

    // 5. Validate agreement status (must be 'accepted')
    const [agreementRows] = await connection.query(
      `SELECT id, agreement_reference, agreement_status, accepted_at
       FROM rental_agreements
       WHERE booking_id = ?
       FOR UPDATE`,
      [booking_id]
    )

    if (agreementRows.length === 0 || agreementRows[0].agreement_status !== 'accepted') {
      await connection.rollback()
      return sendError(
        res,
        'Cannot hand over vehicle. Rental agreement must be accepted by customer before vehicle handover.',
        400
      )
    }

    // 6. Check vehicle availability safety
    if (vehicle.availability_status === 'maintenance' || vehicle.availability_status === 'decommissioned') {
      await connection.rollback()
      return sendError(res, `Cannot hand over vehicle currently in '${vehicle.availability_status}' status.`, 400)
    }

    const [activeCollisions] = await connection.query(
      `SELECT id, booking_reference
       FROM bookings
       WHERE vehicle_id = ?
         AND booking_status = 'active'
         AND id != ?
       LIMIT 1
       FOR UPDATE`,
      [vehicleId, booking_id]
    )

    if (activeCollisions.length > 0) {
      await connection.rollback()
      return sendError(
        res,
        `Cannot hand over vehicle. Vehicle is currently out on another active rental (${activeCollisions[0].booking_reference}).`,
        409
      )
    }

    // 7. Resolve staff ID
    const validStaffId = await resolveStaffId(staffIdFromAuth, connection)

    // 8. Determine handover datetime
    const effectiveHandoverTime = handover_datetime ? new Date(handover_datetime) : new Date()
    const formattedHandoverTime = isNaN(effectiveHandoverTime.getTime())
      ? new Date().toISOString().slice(0, 19).replace('T', ' ')
      : effectiveHandoverTime.toISOString().slice(0, 19).replace('T', ' ')

    // 9. Update booking status to active
    await connection.query(
      `UPDATE bookings
       SET booking_status = 'active',
           approved_by_staff_id = COALESCE(?, approved_by_staff_id),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [validStaffId, booking_id]
    )

    // 10. Update vehicle availability to rented
    await connection.query(
      `UPDATE vehicles
       SET availability_status = 'rented',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [vehicleId]
    )

    // 11. Insert rental_handover record
    const [insertResult] = await connection.query(
      `INSERT INTO rental_handover (
         booking_id,
         staff_id,
         handover_datetime,
         odometer_reading,
         fuel_level_percent,
         customer_signature_confirmed,
         handover_notes
       ) VALUES (?, ?, ?, ?, ?, 1, ?)`,
      [
        booking_id,
        validStaffId,
        formattedHandoverTime,
        Math.round(odoNum),
        fuelResult.value,
        handover_notes ? String(handover_notes).trim() : null
      ]
    )

    await connection.commit()

    // 12. Fetch saved handover with staff details for response
    const [savedRows] = await pool.query(
      `SELECT rh.id, rh.booking_id, rh.handover_datetime, rh.odometer_reading,
              rh.fuel_level_percent, rh.handover_notes, rh.customer_signature_confirmed,
              rh.created_at,
              b.booking_reference, b.booking_status,
              v.id AS vehicle_id, v.make, v.model, v.registration_number, v.availability_status AS vehicle_availability,
              c.id AS customer_id, c.first_name, c.last_name, c.email,
              s.id AS staff_id, s.first_name AS staff_first_name, s.last_name AS staff_last_name
       FROM rental_handover rh
       JOIN bookings b ON rh.booking_id = b.id
       JOIN vehicles v ON b.vehicle_id = v.id
       JOIN customers c ON b.customer_id = c.id
       LEFT JOIN staff s ON rh.staff_id = s.id
       WHERE rh.id = ?`,
      [insertResult.insertId]
    )

    const saved = savedRows[0]

    return sendSuccess(res, 'Vehicle handover recorded successfully. Booking is now active and vehicle is rented.', {
      id: saved.id,
      booking_id: saved.booking_id,
      booking_reference: saved.booking_reference,
      booking_status: 'active',
      vehicle_availability: 'rented',
      handover_datetime: saved.handover_datetime,
      odometer_reading: saved.odometer_reading,
      fuel_level_percent: saved.fuel_level_percent,
      fuel_level_display: getFuelLevelDisplay(saved.fuel_level_percent),
      handover_notes: saved.handover_notes || '',
      customer: {
        id: saved.customer_id,
        name: `${saved.first_name} ${saved.last_name}`,
        email: saved.email
      },
      vehicle: {
        id: saved.vehicle_id,
        make: saved.make,
        model: saved.model,
        registration_number: saved.registration_number
      },
      recorded_by: saved.staff_first_name
        ? `${saved.staff_first_name} ${saved.staff_last_name}`
        : 'Fleet Staff'
    }, 201)

  } catch (err) {
    await connection.rollback()
    console.error('recordVehicleHandover error:', err)
    return sendError(res, err.message || 'Failed to record vehicle handover.', 500)
  } finally {
    connection.release()
  }
}

/**
 * Retrieve vehicle handover details for a booking
 * GET /api/v1/handovers/booking/:bookingId
 * Flexible: Customer (own booking) or Staff
 */
export const getHandoverByBooking = async (req, res) => {
  await ensureHandoverTable()

  const { bookingId } = req.params
  if (!bookingId || isNaN(Number(bookingId))) {
    return sendError(res, 'Valid booking ID is required.', 400)
  }

  try {
    // 1. Fetch booking info and check authorization
    const [bookingRows] = await pool.query(
      `SELECT b.id, b.booking_reference, b.customer_id, b.vehicle_id, b.booking_status,
              b.start_date, b.end_date,
              c.first_name, c.last_name, c.email,
              v.make, v.model, v.registration_number, v.availability_status
       FROM bookings b
       JOIN customers c ON b.customer_id = c.id
       JOIN vehicles v ON b.vehicle_id = v.id
       WHERE b.id = ?`,
      [bookingId]
    )

    if (bookingRows.length === 0) {
      return sendError(res, 'Booking not found.', 404)
    }

    const booking = bookingRows[0]

    // Customer ownership check
    if (req.customer && Number(req.customer.id) !== Number(booking.customer_id)) {
      return sendError(res, 'Access denied. You can only view handover details for your own bookings.', 403)
    }

    // 2. Fetch rental agreement status for this booking
    const [agreementRows] = await pool.query(
      `SELECT id, agreement_reference, agreement_status, accepted_at
       FROM rental_agreements
       WHERE booking_id = ?`,
      [bookingId]
    )
    const agreement = agreementRows[0] || null

    // 3. Fetch handover record if exists
    const [handoverRows] = await pool.query(
      `SELECT rh.id, rh.booking_id, rh.handover_datetime, rh.odometer_reading,
              rh.fuel_level_percent, rh.handover_notes, rh.customer_signature_confirmed,
              rh.created_at,
              s.first_name AS staff_first_name, s.last_name AS staff_last_name
       FROM rental_handover rh
       LEFT JOIN staff s ON rh.staff_id = s.id
       WHERE rh.booking_id = ?`,
      [bookingId]
    )

    if (handoverRows.length === 0) {
      // Determine awaiting stage
      let stage = 'not_started'
      let stageMessage = 'Vehicle handover has not been started.'

      if (booking.booking_status === 'confirmed') {
        if (agreement && agreement.agreement_status === 'accepted') {
          stage = 'ready_for_handover'
          stageMessage = 'Agreement accepted. Awaiting vehicle handover at hub.'
        } else {
          stage = 'agreement_required'
          stageMessage = 'Rental agreement acceptance required before vehicle handover.'
        }
      } else if (booking.booking_status === 'pending') {
        stage = 'pending_confirmation'
        stageMessage = 'Booking confirmation and payment required before vehicle handover.'
      } else if (booking.booking_status === 'cancelled') {
        stage = 'cancelled'
        stageMessage = 'Booking was cancelled. Vehicle handover not applicable.'
      } else if (booking.booking_status === 'completed') {
        stage = 'completed'
        stageMessage = 'Rental completed.'
      }

      return sendSuccess(res, 'Handover status retrieved.', {
        handed_over: false,
        handover: null,
        stage,
        stage_message: stageMessage,
        booking: {
          id: booking.id,
          booking_reference: booking.booking_reference,
          booking_status: booking.booking_status,
          customer_id: booking.customer_id,
          customer_name: `${booking.first_name} ${booking.last_name}`,
          vehicle: {
            make: booking.make,
            model: booking.model,
            registration_number: booking.registration_number,
            availability_status: booking.availability_status
          }
        },
        agreement: agreement ? {
          reference: agreement.agreement_reference,
          status: agreement.agreement_status,
          accepted_at: agreement.accepted_at
        } : null
      })
    }

    const h = handoverRows[0]

    return sendSuccess(res, 'Vehicle handover details retrieved.', {
      handed_over: true,
      stage: 'completed',
      stage_message: 'Vehicle handover completed. Rental is active.',
      handover: {
        id: h.id,
        booking_id: h.booking_id,
        booking_reference: booking.booking_reference,
        booking_status: booking.booking_status,
        handover_datetime: h.handover_datetime,
        odometer_reading: h.odometer_reading,
        fuel_level_percent: h.fuel_level_percent,
        fuel_level_display: getFuelLevelDisplay(h.fuel_level_percent),
        handover_notes: h.handover_notes || '',
        customer_signature_confirmed: Boolean(h.customer_signature_confirmed),
        recorded_by: h.staff_first_name
          ? `${h.staff_first_name} ${h.staff_last_name}`
          : 'Fleet Staff',
        created_at: h.created_at
      },
      booking: {
        id: booking.id,
        booking_reference: booking.booking_reference,
        booking_status: booking.booking_status,
        customer_id: booking.customer_id,
        customer_name: `${booking.first_name} ${booking.last_name}`,
        vehicle: {
          make: booking.make,
          model: booking.model,
          registration_number: booking.registration_number,
          availability_status: booking.availability_status
        }
      },
      agreement: agreement ? {
        reference: agreement.agreement_reference,
        status: agreement.agreement_status,
        accepted_at: agreement.accepted_at
      } : null
    })

  } catch (err) {
    console.error('getHandoverByBooking error:', err)
    return sendError(res, 'Failed to fetch handover details.', 500)
  }
}

/**
 * List recent vehicle handovers (Admin/Staff only)
 * GET /api/v1/handovers/admin/list
 */
export const getAdminHandoversList = async (req, res) => {
  await ensureHandoverTable()

  try {
    const [rows] = await pool.query(
      `SELECT rh.id, rh.booking_id, rh.handover_datetime, rh.odometer_reading,
              rh.fuel_level_percent, rh.handover_notes, rh.created_at,
              b.booking_reference, b.booking_status,
              c.first_name AS customer_first_name, c.last_name AS customer_last_name,
              v.make, v.model, v.registration_number,
              s.first_name AS staff_first_name, s.last_name AS staff_last_name
       FROM rental_handover rh
       JOIN bookings b ON rh.booking_id = b.id
       JOIN customers c ON b.customer_id = c.id
       JOIN vehicles v ON b.vehicle_id = v.id
       LEFT JOIN staff s ON rh.staff_id = s.id
       ORDER BY rh.handover_datetime DESC
       LIMIT 100`
    )

    const list = rows.map(r => ({
      id: r.id,
      booking_id: r.booking_id,
      booking_reference: r.booking_reference,
      booking_status: r.booking_status,
      customer_name: `${r.customer_first_name} ${r.customer_last_name}`,
      vehicle: `${r.make} ${r.model} (${r.registration_number})`,
      handover_datetime: r.handover_datetime,
      odometer_reading: r.odometer_reading,
      fuel_level_percent: r.fuel_level_percent,
      fuel_level_display: getFuelLevelDisplay(r.fuel_level_percent),
      recorded_by: r.staff_first_name ? `${r.staff_first_name} ${r.staff_last_name}` : 'Staff',
      handover_notes: r.handover_notes || ''
    }))

    return sendSuccess(res, 'Handovers list retrieved.', { handovers: list })
  } catch (err) {
    console.error('getAdminHandoversList error:', err)
    return sendError(res, 'Failed to list handovers.', 500)
  }
}
