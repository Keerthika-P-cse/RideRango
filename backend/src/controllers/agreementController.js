import pool from '../config/db.js'
import { sendSuccess, sendError } from '../utils/apiResponse.js'

let tableInitialized = false

/**
 * Helper to ensure the rental_agreements table exists in database.
 * Completely idempotent across MySQL and TiDB Cloud.
 */
export async function ensureAgreementTable() {
  if (tableInitialized) return
  try {
    const ddl = `
      CREATE TABLE IF NOT EXISTS rental_agreements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        agreement_reference VARCHAR(50) NOT NULL UNIQUE,
        booking_id INT NOT NULL UNIQUE,
        customer_id INT NOT NULL,
        vehicle_id INT NOT NULL,
        generated_by_staff_id INT DEFAULT NULL,
        agreement_status ENUM('pending', 'accepted') NOT NULL DEFAULT 'pending',
        terms_content TEXT DEFAULT NULL,
        accepted_at DATETIME DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_agreements_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
        CONSTRAINT fk_agreements_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
        CONSTRAINT fk_agreements_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
        CONSTRAINT fk_agreements_staff FOREIGN KEY (generated_by_staff_id) REFERENCES staff(id) ON DELETE SET NULL,
        INDEX idx_agreements_booking (booking_id),
        INDEX idx_agreements_customer (customer_id),
        INDEX idx_agreements_status (agreement_status)
      ) ENGINE=InnoDB;
    `
    await pool.query(ddl)
    tableInitialized = true
  } catch (err) {
    // If table already exists or permission restricted, continue gracefully
    if (err.code !== 'ER_TABLE_EXISTS_ERROR') {
      console.warn('ensureAgreementTable note:', err.message)
    }
    tableInitialized = true
  }
}

/**
 * Standard Demo Rental Terms Clauses
 */
function buildAgreementTerms(booking, customer, vehicle) {
  const returnSchedule = new Date(booking.end_date).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
  const depositStr = Number(booking.security_deposit_amount || 0).toLocaleString('en-IN')

  return [
    {
      title: '1. Authorized Vehicle Operation',
      clause: `The vehicle (${vehicle.make} ${vehicle.model}, Reg: ${vehicle.registration_number}) shall be operated solely by the verified registered hirer (${customer.first_name} ${customer.last_name}). Unauthorized handover, sub-leasing, or third-party driving is strictly prohibited.`
    },
    {
      title: '2. Speed Limits & Traffic Laws',
      clause: 'The hirer agrees to adhere strictly to all Indian Motor Vehicles Act statutory regulations, posted speed limits, and traffic rules. Any speed-camera penalties, traffic challans, or fines accrued during the rental period are the personal liability of the hirer.'
    },
    {
      title: '3. Hub Return & Inspection Condition',
      clause: `The vehicle must be returned to the designated hub (${booking.pickup_location}) on or before ${returnSchedule} in the same clean, operational condition as received, subject only to reasonable road wear.`
    },
    {
      title: '4. Fuel Level & Mileage Policy',
      clause: 'The vehicle is issued with a documented fuel level. The hirer is required to return the vehicle at the identical fuel level; any fuel deficiency will be settled against the final rental balance.'
    },
    {
      title: '5. Damage Responsibility & Security Deposit',
      clause: `The customer agrees that in the event of new vehicle body or mechanical damage during the rental tenure, the demonstration security deposit of ₹${depositStr} may be retained subject to joint physical inspection.`
    },
    {
      title: '6. Academic Demonstration Notice',
      clause: 'SAMPLE – COLLEGE PROJECT DEMONSTRATION – NOT A LEGAL CONTRACT. This electronic agreement is an academic demonstration feature built for the RideRango vehicle rental project and does not constitute a legally binding commercial contract.'
    }
  ]
}

/**
 * 1. Admin/Staff: Generate Sample Agreement for a Confirmed Booking
 * POST /api/v1/agreements/generate
 */
export const generateAgreement = async (req, res) => {
  try {
    await ensureAgreementTable()
    const staffId = req.staff?.id || null
    const { booking_id } = req.body

    if (!booking_id) {
      return sendError(res, 'Booking ID is required to generate an agreement.', 400)
    }

    // Retrieve booking with customer and vehicle details
    const [bookingRows] = await pool.query(
      `SELECT b.*,
              c.id AS customer_id, c.first_name AS customer_first_name, c.last_name AS customer_last_name,
              c.email AS customer_email, c.phone AS customer_phone, c.driving_license_number,
              v.id AS vehicle_id, v.make, v.model, v.year, v.registration_number, v.color, v.fuel_type, v.transmission,
              vc.name AS category_name
       FROM bookings b
       JOIN customers c ON b.customer_id = c.id
       JOIN vehicles v ON b.vehicle_id = v.id
       LEFT JOIN vehicle_categories vc ON v.category_id = vc.id
       WHERE b.id = ? OR b.booking_reference = ?`,
      [booking_id, booking_id]
    )

    if (bookingRows.length === 0) {
      return sendError(res, 'Booking not found.', 404)
    }

    const booking = bookingRows[0]

    // Validate booking eligibility: only confirmed, active, or completed bookings can generate agreements
    const eligibleStatuses = ['confirmed', 'active', 'completed']
    if (!eligibleStatuses.includes(booking.booking_status)) {
      return sendError(
        res,
        `Agreements can only be generated for confirmed bookings. Current booking status is '${booking.booking_status}'.`,
        400
      )
    }

    // Check if an agreement already exists for this booking
    const [existingRows] = await pool.query(
      'SELECT * FROM rental_agreements WHERE booking_id = ?',
      [booking.id]
    )

    if (existingRows.length > 0) {
      const existing = existingRows[0]
      if (existing.agreement_status === 'accepted') {
        return sendError(
          res,
          'A rental agreement for this booking has already been accepted by the customer and cannot be regenerated.',
          409
        )
      }
      // Return existing pending agreement idempotently
      let parsedTerms = []
      try {
        parsedTerms = JSON.parse(existing.terms_content)
      } catch {
        parsedTerms = []
      }
      return sendSuccess(res, 'Rental agreement already exists for this booking.', {
        id: existing.id,
        agreement_reference: existing.agreement_reference,
        booking_id: existing.booking_id,
        booking_reference: booking.booking_reference,
        customer_id: existing.customer_id,
        vehicle_id: existing.vehicle_id,
        agreement_status: existing.agreement_status,
        terms_content: parsedTerms,
        accepted_at: existing.accepted_at,
        created_at: existing.created_at,
        customer: {
          name: `${booking.customer_first_name} ${booking.customer_last_name}`,
          email: booking.customer_email,
          phone: booking.customer_phone,
          driving_license_number: booking.driving_license_number
        },
        vehicle: {
          make: booking.make,
          model: booking.model,
          year: booking.year,
          category_name: booking.category_name,
          registration_number: booking.registration_number
        },
        rental: {
          start_date: booking.start_date,
          end_date: booking.end_date,
          pickup_location: booking.pickup_location,
          dropoff_location: booking.dropoff_location,
          total_days: booking.total_days,
          rental_rate_per_day: booking.rental_rate_per_day,
          base_rental_amount: booking.base_rental_amount,
          security_deposit_amount: booking.security_deposit_amount,
          total_amount: booking.total_amount
        }
      })
    }

    // Generate new agreement
    const agreementReference = `AGR-${booking.booking_reference}`
    const terms = buildAgreementTerms(booking, {
      first_name: booking.customer_first_name,
      last_name: booking.customer_last_name
    }, {
      make: booking.make,
      model: booking.model,
      registration_number: booking.registration_number
    })
    const termsJson = JSON.stringify(terms)

    const [insertResult] = await pool.query(
      `INSERT INTO rental_agreements
       (agreement_reference, booking_id, customer_id, vehicle_id, generated_by_staff_id, agreement_status, terms_content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [agreementReference, booking.id, booking.customer_id, booking.vehicle_id, staffId, termsJson]
    )

    return sendSuccess(
      res,
      'Rental agreement generated successfully. Status is now Pending Customer Acceptance.',
      {
        id: insertResult.insertId,
        agreement_reference: agreementReference,
        booking_id: booking.id,
        booking_reference: booking.booking_reference,
        customer_id: booking.customer_id,
        vehicle_id: booking.vehicle_id,
        agreement_status: 'pending',
        terms_content: terms,
        accepted_at: null,
        created_at: new Date().toISOString(),
        customer: {
          name: `${booking.customer_first_name} ${booking.customer_last_name}`,
          email: booking.customer_email,
          phone: booking.customer_phone,
          driving_license_number: booking.driving_license_number
        },
        vehicle: {
          make: booking.make,
          model: booking.model,
          year: booking.year,
          category_name: booking.category_name,
          registration_number: booking.registration_number
        },
        rental: {
          start_date: booking.start_date,
          end_date: booking.end_date,
          pickup_location: booking.pickup_location,
          dropoff_location: booking.dropoff_location,
          total_days: booking.total_days,
          rental_rate_per_day: booking.rental_rate_per_day,
          base_rental_amount: booking.base_rental_amount,
          security_deposit_amount: booking.security_deposit_amount,
          total_amount: booking.total_amount
        }
      },
      201
    )
  } catch (err) {
    console.error('generateAgreement error:', err)
    return sendError(res, err.message || 'Failed to generate rental agreement.', 500)
  }
}

/**
 * 2. Get Agreement by Booking Reference or ID
 * GET /api/v1/agreements/booking/:bookingId
 * Authenticated: accessible by authorized customer or staff.
 */
export const getAgreementByBooking = async (req, res) => {
  try {
    await ensureAgreementTable()
    const { bookingId } = req.params

    // Retrieve booking first to verify ownership and existence
    const [bookingRows] = await pool.query(
      `SELECT b.*,
              c.first_name AS customer_first_name, c.last_name AS customer_last_name,
              c.email AS customer_email, c.phone AS customer_phone, c.driving_license_number,
              v.make, v.model, v.year, v.registration_number, v.color, v.fuel_type, v.transmission,
              vc.name AS category_name
       FROM bookings b
       JOIN customers c ON b.customer_id = c.id
       JOIN vehicles v ON b.vehicle_id = v.id
       LEFT JOIN vehicle_categories vc ON v.category_id = vc.id
       WHERE b.id = ? OR b.booking_reference = ?`,
      [bookingId, bookingId]
    )

    if (bookingRows.length === 0) {
      return sendError(res, 'Associated booking not found.', 404)
    }

    const booking = bookingRows[0]

    // Authorization check: if authenticated as customer, customer must own the booking!
    if (req.customer && req.customer.id !== booking.customer_id) {
      return sendError(res, 'Access denied. You can only view agreements for your own bookings.', 403)
    }

    // Query agreement for this booking
    const [agreementRows] = await pool.query(
      `SELECT ra.*, s.first_name AS staff_first_name, s.last_name AS staff_last_name
       FROM rental_agreements ra
       LEFT JOIN staff s ON ra.generated_by_staff_id = s.id
       WHERE ra.booking_id = ?`,
      [booking.id]
    )

    if (agreementRows.length === 0) {
      return sendSuccess(res, 'Agreement status retrieved.', {
        status: 'not_generated',
        booking_id: booking.id,
        booking_reference: booking.booking_reference,
        booking_status: booking.booking_status
      })
    }

    const agreement = agreementRows[0]
    let parsedTerms = []
    try {
      parsedTerms = JSON.parse(agreement.terms_content)
    } catch {
      parsedTerms = []
    }

    return sendSuccess(res, 'Rental agreement retrieved successfully.', {
      id: agreement.id,
      agreement_reference: agreement.agreement_reference,
      booking_id: agreement.booking_id,
      booking_reference: booking.booking_reference,
      booking_status: booking.booking_status,
      customer_id: agreement.customer_id,
      vehicle_id: agreement.vehicle_id,
      agreement_status: agreement.agreement_status,
      display_status: agreement.agreement_status === 'accepted' ? 'Accepted' : 'Pending Customer Acceptance',
      terms_content: parsedTerms,
      accepted_at: agreement.accepted_at,
      created_at: agreement.created_at,
      generated_by_staff: agreement.staff_first_name ? `${agreement.staff_first_name} ${agreement.staff_last_name}` : 'Staff',
      customer: {
        id: booking.customer_id,
        name: `${booking.customer_first_name} ${booking.customer_last_name}`,
        email: booking.customer_email,
        phone: booking.customer_phone,
        driving_license_number: booking.driving_license_number
      },
      vehicle: {
        make: booking.make,
        model: booking.model,
        year: booking.year,
        category_name: booking.category_name,
        registration_number: booking.registration_number
      },
      rental: {
        start_date: booking.start_date,
        end_date: booking.end_date,
        pickup_location: booking.pickup_location,
        dropoff_location: booking.dropoff_location,
        total_days: booking.total_days,
        rental_rate_per_day: booking.rental_rate_per_day,
        base_rental_amount: booking.base_rental_amount,
        security_deposit_amount: booking.security_deposit_amount,
        total_amount: booking.total_amount
      }
    })
  } catch (err) {
    console.error('getAgreementByBooking error:', err)
    return sendError(res, 'Failed to retrieve rental agreement.', 500)
  }
}

/**
 * 3. Customer: Accept Rental Agreement
 * POST /api/v1/agreements/:id/accept
 * Customer authenticated strictly.
 */
export const acceptAgreement = async (req, res) => {
  try {
    await ensureAgreementTable()
    const customerId = req.customer.id
    const agreementId = req.params.id

    const [rows] = await pool.query(
      `SELECT ra.*, b.booking_reference
       FROM rental_agreements ra
       JOIN bookings b ON ra.booking_id = b.id
       WHERE ra.id = ?`,
      [agreementId]
    )

    if (rows.length === 0) {
      return sendError(res, 'Rental agreement not found.', 404)
    }

    const agreement = rows[0]

    // Verify ownership: customer must match agreement customer_id
    if (agreement.customer_id !== customerId) {
      return sendError(res, 'Access denied. You can only accept agreements for your own bookings.', 403)
    }

    // Idempotent: If already accepted, return success without duplicate update
    if (agreement.agreement_status === 'accepted') {
      return sendSuccess(res, 'Agreement has already been accepted.', {
        id: agreement.id,
        agreement_reference: agreement.agreement_reference,
        booking_id: agreement.booking_id,
        booking_reference: agreement.booking_reference,
        agreement_status: 'accepted',
        accepted_at: agreement.accepted_at,
        already_accepted: true
      })
    }

    // Update status to accepted with current timestamp
    await pool.query(
      `UPDATE rental_agreements
       SET agreement_status = 'accepted', accepted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [agreement.id]
    )

    const [updatedRows] = await pool.query(
      'SELECT accepted_at FROM rental_agreements WHERE id = ?',
      [agreement.id]
    )
    const acceptedAt = updatedRows[0]?.accepted_at || new Date().toISOString()

    return sendSuccess(res, 'Rental agreement accepted successfully.', {
      id: agreement.id,
      agreement_reference: agreement.agreement_reference,
      booking_id: agreement.booking_id,
      booking_reference: agreement.booking_reference,
      agreement_status: 'accepted',
      accepted_at: acceptedAt
    })
  } catch (err) {
    console.error('acceptAgreement error:', err)
    return sendError(res, 'Failed to accept rental agreement.', 500)
  }
}

/**
 * 4. Staff/Admin: List All Agreements
 * GET /api/v1/agreements/admin/list
 */
export const getAdminAgreementsList = async (req, res) => {
  try {
    await ensureAgreementTable()

    const [rows] = await pool.query(
      `SELECT ra.id, ra.agreement_reference, ra.booking_id, ra.customer_id, ra.vehicle_id,
              ra.agreement_status, ra.accepted_at, ra.created_at, ra.updated_at,
              b.booking_reference, b.booking_status, b.start_date, b.end_date, b.total_amount,
              c.first_name AS customer_first_name, c.last_name AS customer_last_name, c.email AS customer_email, c.phone AS customer_phone,
              v.make, v.model, v.registration_number,
              s.first_name AS staff_first_name, s.last_name AS staff_last_name
       FROM rental_agreements ra
       JOIN bookings b ON ra.booking_id = b.id
       JOIN customers c ON ra.customer_id = c.id
       JOIN vehicles v ON ra.vehicle_id = v.id
       LEFT JOIN staff s ON ra.generated_by_staff_id = s.id
       ORDER BY ra.created_at DESC`
    )

    const list = rows.map(r => ({
      id: r.id,
      agreement_reference: r.agreement_reference,
      booking_id: r.booking_id,
      booking_reference: r.booking_reference,
      booking_status: r.booking_status,
      customer_id: r.customer_id,
      customer_name: `${r.customer_first_name} ${r.customer_last_name}`,
      customer_email: r.customer_email,
      customer_phone: r.customer_phone,
      vehicle: `${r.make} ${r.model} (${r.registration_number})`,
      agreement_status: r.agreement_status,
      display_status: r.agreement_status === 'accepted' ? 'Accepted' : 'Pending Customer Acceptance',
      accepted_at: r.accepted_at,
      created_at: r.created_at,
      generated_by: r.staff_first_name ? `${r.staff_first_name} ${r.staff_last_name}` : 'Staff'
    }))

    return sendSuccess(res, 'Rental agreements retrieved.', list)
  } catch (err) {
    console.error('getAdminAgreementsList error:', err)
    return sendError(res, 'Failed to retrieve agreements list.', 500)
  }
}
