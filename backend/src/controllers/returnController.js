import pool from '../config/db.js'
import { sendSuccess, sendError } from '../utils/apiResponse.js'

let tableInitialized = false

/**
 * Helper to ensure the rental_returns table exists in database.
 * Fully idempotent across MySQL and TiDB Cloud.
 */
export async function ensureReturnsTable() {
  if (tableInitialized) return
  try {
    const ddl = `
      CREATE TABLE IF NOT EXISTS rental_returns (
        id INT AUTO_INCREMENT PRIMARY KEY,
        booking_id INT NOT NULL UNIQUE,
        staff_id INT NOT NULL,
        return_datetime DATETIME NOT NULL,
        odometer_reading INT NOT NULL,
        fuel_level_percent INT NOT NULL CHECK (fuel_level_percent BETWEEN 0 AND 100),
        return_condition_notes TEXT DEFAULT NULL,
        damages_identified BOOLEAN NOT NULL DEFAULT FALSE,
        late_return_hours INT NOT NULL DEFAULT 0,
        inspection_status ENUM('passed', 'flagged_for_charges', 'escalated') NOT NULL DEFAULT 'passed',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_returns_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT,
        CONSTRAINT fk_returns_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE RESTRICT,
        INDEX idx_returns_booking (booking_id),
        INDEX idx_returns_staff (staff_id),
        INDEX idx_returns_inspection (inspection_status)
      ) ENGINE=InnoDB;
    `
    await pool.query(ddl)

    // Add vehicle_condition column safely if not exists
    try {
      const [colRows] = await pool.query(
        "SHOW COLUMNS FROM rental_returns LIKE 'vehicle_condition'"
      )
      if (colRows.length === 0) {
        await pool.query(
          "ALTER TABLE rental_returns ADD COLUMN vehicle_condition VARCHAR(50) DEFAULT 'Good'"
        )
      }
    } catch {
      // Ignore alter table errors
    }

    tableInitialized = true
  } catch (err) {
    if (err.code !== 'ER_TABLE_EXISTS_ERROR') {
      console.warn('ensureReturnsTable note:', err.message)
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
 * Validate and normalize vehicle condition
 */
export function normalizeCondition(condition) {
  if (!condition) {
    return { valid: false, error: 'Vehicle condition is required.' }
  }

  const c = String(condition).trim().toLowerCase()
  if (c === 'excellent') {
    return {
      valid: true,
      condition: 'Excellent',
      inspection_status: 'passed',
      damages_identified: 0
    }
  }
  if (c === 'good') {
    return {
      valid: true,
      condition: 'Good',
      inspection_status: 'passed',
      damages_identified: 0
    }
  }
  if (c === 'minor damage' || c === 'minordamage' || c === 'minor_damage') {
    return {
      valid: true,
      condition: 'Minor Damage',
      inspection_status: 'flagged_for_charges',
      damages_identified: 1
    }
  }
  if (c === 'major damage' || c === 'majordamage' || c === 'major_damage') {
    return {
      valid: true,
      condition: 'Major Damage',
      inspection_status: 'escalated',
      damages_identified: 1
    }
  }

  return {
    valid: false,
    error: 'Invalid vehicle condition. Allowed values: Excellent, Good, Minor Damage, Major Damage.'
  }
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
 * Record Vehicle Return & Inspection (Admin/Staff only)
 * POST /api/v1/returns
 */
export const recordVehicleReturn = async (req, res) => {
  await ensureReturnsTable()

  const {
    booking_id,
    odometer_reading,
    fuel_level,
    vehicle_condition,
    return_notes = '',
    return_datetime
  } = req.body

  if (!booking_id || isNaN(Number(booking_id))) {
    return sendError(res, 'Valid booking ID is required.', 400)
  }

  const endOdo = Number(odometer_reading)
  if (isNaN(endOdo) || endOdo < 0) {
    return sendError(res, 'Ending odometer reading must be a valid non-negative number.', 400)
  }

  const fuelResult = normalizeFuelLevel(fuel_level)
  if (!fuelResult.valid) {
    return sendError(res, fuelResult.error, 400)
  }

  const condResult = normalizeCondition(vehicle_condition)
  if (!condResult.valid) {
    return sendError(res, condResult.error, 400)
  }

  const staffIdFromAuth = req.staff?.id || req.user?.id || null

  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    // 1. Lock booking row and check existence
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

    // 3. Prevent duplicate return inspection
    const [existingReturn] = await connection.query(
      `SELECT id, return_datetime, odometer_reading, fuel_level_percent
       FROM rental_returns
       WHERE booking_id = ?
       FOR UPDATE`,
      [booking_id]
    )

    if (existingReturn.length > 0) {
      await connection.rollback()
      return sendError(res, 'Vehicle return inspection has already been recorded for this booking.', 409)
    }

    // 4. Validate booking status eligibility (must be 'active')
    if (booking.booking_status !== 'active') {
      await connection.rollback()
      let detail = `Vehicle return can only be recorded for active rentals (current status: '${booking.booking_status}').`
      if (booking.booking_status === 'pending') {
        detail = 'Cannot return vehicle for a pending unconfirmed booking.'
      } else if (booking.booking_status === 'confirmed') {
        detail = 'Cannot return vehicle before vehicle handover has been recorded.'
      } else if (booking.booking_status === 'completed') {
        detail = 'Vehicle return and rental closure have already been completed.'
      } else if (booking.booking_status === 'cancelled') {
        detail = 'Cannot return vehicle for a cancelled booking.'
      }
      return sendError(res, detail, 400)
    }

    // 5. Look up Handover record to get starting odometer and starting fuel
    const [handoverRows] = await connection.query(
      `SELECT id, odometer_reading, fuel_level_percent, handover_datetime
       FROM rental_handover
       WHERE booking_id = ?
       FOR UPDATE`,
      [booking_id]
    )

    if (handoverRows.length === 0) {
      await connection.rollback()
      return sendError(
        res,
        'Cannot record vehicle return. Completed vehicle handover record is required.',
        400
      )
    }

    const handover = handoverRows[0]
    const startOdo = Number(handover.odometer_reading)

    // 6. Validate ending odometer >= starting odometer
    if (endOdo < startOdo) {
      await connection.rollback()
      return sendError(
        res,
        `Ending odometer reading (${endOdo.toLocaleString('en-IN')} km) cannot be less than starting odometer (${startOdo.toLocaleString('en-IN')} km).`,
        400
      )
    }

    // Backend calculates exact distance travelled
    const distanceTravelled = endOdo - startOdo

    // 7. Resolve staff ID
    const validStaffId = await resolveStaffId(staffIdFromAuth, connection)

    // 8. Determine return datetime
    const effectiveReturnTime = return_datetime ? new Date(return_datetime) : new Date()
    const formattedReturnTime = isNaN(effectiveReturnTime.getTime())
      ? new Date().toISOString().slice(0, 19).replace('T', ' ')
      : effectiveReturnTime.toISOString().slice(0, 19).replace('T', ' ')

    // 9. Format return condition notes
    const fullNotes = return_notes
      ? `[Condition: ${condResult.condition}] ${String(return_notes).trim()}`
      : `[Condition: ${condResult.condition}]`

    // 10. Insert rental_returns record
    // Note: We check if vehicle_condition column is present in the table
    let insertSql = `
      INSERT INTO rental_returns (
        booking_id,
        staff_id,
        return_datetime,
        odometer_reading,
        fuel_level_percent,
        return_condition_notes,
        damages_identified,
        inspection_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    let insertParams = [
      booking_id,
      validStaffId,
      formattedReturnTime,
      Math.round(endOdo),
      fuelResult.value,
      fullNotes,
      condResult.damages_identified,
      condResult.inspection_status
    ]

    try {
      const [colCheck] = await connection.query("SHOW COLUMNS FROM rental_returns LIKE 'vehicle_condition'")
      if (colCheck.length > 0) {
        insertSql = `
          INSERT INTO rental_returns (
            booking_id,
            staff_id,
            return_datetime,
            odometer_reading,
            fuel_level_percent,
            return_condition_notes,
            damages_identified,
            inspection_status,
            vehicle_condition
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
        insertParams.push(condResult.condition)
      }
    } catch {
      // Use fallback insertSql
    }

    const [insertResult] = await connection.query(insertSql, insertParams)

    // 11. CRITICAL REQUIREMENT (Phase 6):
    // Completing return inspection must NOT automatically make the vehicle available!
    // Vehicle availability status remains 'rented' (or unavailable), and booking remains 'active'
    // with return inspection pending final charges and settlement in Phase 7.
    // Therefore, do NOT update vehicle to 'available' or booking to 'completed'.

    await connection.commit()

    // 12. Fetch saved return record with staff details for response
    const [savedRows] = await pool.query(
      `SELECT rr.id, rr.booking_id, rr.return_datetime, rr.odometer_reading,
              rr.fuel_level_percent, rr.return_condition_notes, rr.damages_identified,
              rr.inspection_status, rr.created_at,
              b.booking_reference, b.booking_status,
              v.id AS vehicle_id, v.make, v.model, v.registration_number, v.availability_status AS vehicle_availability,
              c.id AS customer_id, c.first_name, c.last_name, c.email,
              s.id AS staff_id, s.first_name AS staff_first_name, s.last_name AS staff_last_name
       FROM rental_returns rr
       JOIN bookings b ON rr.booking_id = b.id
       JOIN vehicles v ON b.vehicle_id = v.id
       JOIN customers c ON b.customer_id = c.id
       LEFT JOIN staff s ON rr.staff_id = s.id
       WHERE rr.id = ?`,
      [insertResult.insertId]
    )

    const saved = savedRows[0]

    return sendSuccess(
      res,
      'Vehicle return and inspection recorded successfully. Rental is awaiting final deposit settlement in Phase 7.',
      {
        id: saved.id,
        booking_id: saved.booking_id,
        booking_reference: saved.booking_reference,
        booking_status: saved.booking_status,
        stage: 'inspection_pending',
        stage_display: 'Return Completed / Inspection Pending',
        return_datetime: saved.return_datetime,
        starting_odometer: startOdo,
        ending_odometer: saved.odometer_reading,
        distance_travelled: distanceTravelled,
        starting_fuel_percent: handover.fuel_level_percent,
        starting_fuel_display: getFuelLevelDisplay(handover.fuel_level_percent),
        ending_fuel_percent: saved.fuel_level_percent,
        ending_fuel_display: getFuelLevelDisplay(saved.fuel_level_percent),
        vehicle_condition: condResult.condition,
        inspection_status: saved.inspection_status,
        damages_identified: Boolean(saved.damages_identified),
        return_notes: saved.return_condition_notes || '',
        vehicle_availability: saved.vehicle_availability,
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
      },
      201
    )

  } catch (err) {
    await connection.rollback()
    console.error('recordVehicleReturn error:', err)
    return sendError(res, err.message || 'Failed to record vehicle return inspection.', 500)
  } finally {
    connection.release()
  }
}

/**
 * Retrieve vehicle return inspection details for a booking
 * GET /api/v1/returns/booking/:bookingId
 * Flexible: Customer (own booking) or Staff
 */
export const getReturnByBooking = async (req, res) => {
  await ensureReturnsTable()

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
      return sendError(res, 'Access denied. You can only view return details for your own bookings.', 403)
    }

    // 2. Fetch Handover record
    const [handoverRows] = await pool.query(
      `SELECT rh.id, rh.odometer_reading, rh.fuel_level_percent, rh.handover_datetime,
              s.first_name AS staff_first_name, s.last_name AS staff_last_name
       FROM rental_handover rh
       LEFT JOIN staff s ON rh.staff_id = s.id
       WHERE rh.booking_id = ?`,
      [bookingId]
    )
    const handover = handoverRows[0] || null

    // 3. Fetch Return record if exists
    const [returnRows] = await pool.query(
      `SELECT rr.id, rr.booking_id, rr.return_datetime, rr.odometer_reading,
              rr.fuel_level_percent, rr.return_condition_notes, rr.damages_identified,
              rr.inspection_status, rr.created_at,
              s.first_name AS staff_first_name, s.last_name AS staff_last_name
       FROM rental_returns rr
       LEFT JOIN staff s ON rr.staff_id = s.id
       WHERE rr.booking_id = ?`,
      [bookingId]
    )

    if (returnRows.length === 0) {
      let stage = 'awaiting_return'
      let stageMessage = 'Vehicle return and inspection not yet recorded.'

      if (booking.booking_status !== 'active') {
        stage = 'not_eligible'
        stageMessage = `Vehicle return can only be recorded for active rentals (current status: '${booking.booking_status}').`
      }

      return sendSuccess(res, 'Return inspection status retrieved.', {
        returned: false,
        return_data: null,
        stage,
        stage_message: stageMessage,
        handover: handover ? {
          handover_datetime: handover.handover_datetime,
          starting_odometer: Number(handover.odometer_reading),
          starting_fuel_percent: handover.fuel_level_percent,
          starting_fuel_display: getFuelLevelDisplay(handover.fuel_level_percent),
          dispatched_by: handover.staff_first_name ? `${handover.staff_first_name} ${handover.staff_last_name}` : 'Staff'
        } : null,
        booking: {
          id: booking.id,
          booking_reference: booking.booking_reference,
          booking_status: booking.booking_status,
          customer_name: `${booking.first_name} ${booking.last_name}`,
          vehicle: {
            make: booking.make,
            model: booking.model,
            registration_number: booking.registration_number,
            availability_status: booking.availability_status
          }
        }
      })
    }

    const r = returnRows[0]
    const startOdo = handover ? Number(handover.odometer_reading) : 0
    const endOdo = Number(r.odometer_reading)
    const distanceTravelled = endOdo >= startOdo ? endOdo - startOdo : 0

    // Extract condition from notes if available
    let extractedCondition = 'Good'
    if (r.return_condition_notes) {
      const match = r.return_condition_notes.match(/\[Condition:\s*([^\]]+)\]/)
      if (match) {
        extractedCondition = match[1].trim()
      }
    }

    return sendSuccess(res, 'Vehicle return details retrieved.', {
      returned: true,
      stage: 'inspection_pending',
      stage_display: 'Return Completed / Inspection Pending',
      return_data: {
        id: r.id,
        booking_id: r.booking_id,
        return_datetime: r.return_datetime,
        starting_odometer: startOdo,
        ending_odometer: endOdo,
        distance_travelled: distanceTravelled,
        starting_fuel_percent: handover ? handover.fuel_level_percent : null,
        starting_fuel_display: handover ? getFuelLevelDisplay(handover.fuel_level_percent) : null,
        ending_fuel_percent: r.fuel_level_percent,
        ending_fuel_display: getFuelLevelDisplay(r.fuel_level_percent),
        vehicle_condition: extractedCondition,
        inspection_status: r.inspection_status,
        damages_identified: Boolean(r.damages_identified),
        return_notes: r.return_condition_notes || '',
        recorded_by: r.staff_first_name ? `${r.staff_first_name} ${r.staff_last_name}` : 'Fleet Staff',
        created_at: r.created_at
      },
      handover: handover ? {
        handover_datetime: handover.handover_datetime,
        starting_odometer: startOdo,
        starting_fuel_percent: handover.fuel_level_percent,
        starting_fuel_display: getFuelLevelDisplay(handover.fuel_level_percent),
        dispatched_by: handover.staff_first_name ? `${handover.staff_first_name} ${handover.staff_last_name}` : 'Staff'
      } : null,
      booking: {
        id: booking.id,
        booking_reference: booking.booking_reference,
        booking_status: booking.booking_status,
        customer_name: `${booking.first_name} ${booking.last_name}`,
        vehicle: {
          make: booking.make,
          model: booking.model,
          registration_number: booking.registration_number,
          availability_status: booking.availability_status
        }
      }
    })

  } catch (err) {
    console.error('getReturnByBooking error:', err)
    return sendError(res, 'Failed to fetch return details.', 500)
  }
}

/**
 * List recent vehicle returns (Admin/Staff only)
 * GET /api/v1/returns/admin/list
 */
export const getAdminReturnsList = async (req, res) => {
  await ensureReturnsTable()

  try {
    const [rows] = await pool.query(
      `SELECT rr.id, rr.booking_id, rr.return_datetime, rr.odometer_reading,
              rr.fuel_level_percent, rr.return_condition_notes, rr.inspection_status,
              rr.damages_identified, rr.created_at,
              b.booking_reference, b.booking_status,
              c.first_name AS customer_first_name, c.last_name AS customer_last_name,
              v.make, v.model, v.registration_number,
              s.first_name AS staff_first_name, s.last_name AS staff_last_name,
              rh.odometer_reading AS starting_odometer
       FROM rental_returns rr
       JOIN bookings b ON rr.booking_id = b.id
       JOIN customers c ON b.customer_id = c.id
       JOIN vehicles v ON b.vehicle_id = v.id
       LEFT JOIN staff s ON rr.staff_id = s.id
       LEFT JOIN rental_handover rh ON b.id = rh.booking_id
       ORDER BY rr.return_datetime DESC
       LIMIT 100`
    )

    const list = rows.map(r => {
      const startOdo = r.starting_odometer ? Number(r.starting_odometer) : 0
      const endOdo = Number(r.odometer_reading)
      const distance = endOdo >= startOdo ? endOdo - startOdo : 0

      let extractedCondition = 'Good'
      if (r.return_condition_notes) {
        const match = r.return_condition_notes.match(/\[Condition:\s*([^\]]+)\]/)
        if (match) extractedCondition = match[1].trim()
      }

      return {
        id: r.id,
        booking_id: r.booking_id,
        booking_reference: r.booking_reference,
        booking_status: r.booking_status,
        customer_name: `${r.customer_first_name} ${r.customer_last_name}`,
        vehicle: `${r.make} ${r.model} (${r.registration_number})`,
        return_datetime: r.return_datetime,
        starting_odometer: startOdo,
        ending_odometer: endOdo,
        distance_travelled: distance,
        fuel_level_percent: r.fuel_level_percent,
        fuel_level_display: getFuelLevelDisplay(r.fuel_level_percent),
        vehicle_condition: extractedCondition,
        inspection_status: r.inspection_status,
        recorded_by: r.staff_first_name ? `${r.staff_first_name} ${r.staff_last_name}` : 'Staff',
        return_notes: r.return_condition_notes || ''
      }
    })

    return sendSuccess(res, 'Returns list retrieved.', { returns: list })
  } catch (err) {
    console.error('getAdminReturnsList error:', err)
    return sendError(res, 'Failed to list returns.', 500)
  }
}
