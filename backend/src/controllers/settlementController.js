import pool from '../config/db.js'
import { sendSuccess, sendError } from '../utils/apiResponse.js'
import { withDeadlockRetry } from '../utils/dbTransactionHelper.js'

let tableInitialized = false

/**
 * Helper to ensure the rental_settlements table exists in the database.
 * Fully idempotent across MySQL and TiDB Cloud.
 */
export async function ensureSettlementsTable() {
  if (tableInitialized) return
  try {
    const ddl = `
      CREATE TABLE IF NOT EXISTS rental_settlements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        booking_id INT NOT NULL UNIQUE,
        settled_by_staff_id INT NOT NULL,
        original_rental_amount DECIMAL(10, 2) NOT NULL,
        distance_travelled INT NOT NULL DEFAULT 0,
        included_distance_km INT NOT NULL DEFAULT 0,
        extra_distance_km INT NOT NULL DEFAULT 0,
        extra_distance_charge DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        ending_fuel_percent INT NOT NULL DEFAULT 100,
        fuel_refill_charge DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        vehicle_condition VARCHAR(50) NOT NULL DEFAULT 'Good',
        damage_charge DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        total_additional_charges DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        final_rental_amount DECIMAL(10, 2) NOT NULL,
        security_deposit_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        deposit_deduction DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        remaining_refund DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        remaining_balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        settlement_status ENUM('pending', 'settled') NOT NULL DEFAULT 'settled',
        settlement_notes TEXT DEFAULT NULL,
        academic_disclaimer VARCHAR(255) NOT NULL DEFAULT 'SAMPLE – COLLEGE PROJECT DEMONSTRATION – NO REAL PAYMENT OR REFUND PROCESSED',
        settled_at DATETIME NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_settlement_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT,
        CONSTRAINT fk_settlement_staff FOREIGN KEY (settled_by_staff_id) REFERENCES staff(id) ON DELETE RESTRICT,
        INDEX idx_settlement_booking (booking_id),
        INDEX idx_settlement_staff (settled_by_staff_id)
      ) ENGINE=InnoDB;
    `
    await pool.query(ddl)
    tableInitialized = true
  } catch (err) {
    if (err.code !== 'ER_TABLE_EXISTS_ERROR') {
      console.warn('ensureSettlementsTable note:', err.message)
    }
    tableInitialized = true
  }
}

/**
 * Pure calculation helper for Phase 7 final settlement charges.
 *
 * Rules:
 * 1. Extra distance charge:
 *    - Included allowance: 150 km/day (based on total_days, minimum 1 day).
 *    - Demo rate: ₹12 per extra km beyond allowance.
 *    - Distance travelled <= allowance => ₹0.
 * 2. Fuel refill charge:
 *    - Based on ending fuel level percentage.
 *    - Full (100%): ₹0.
 *    - Partial/Empty: proportional charge based on missing percentage up to ₹2,000 for 0% (e.g. 75% -> ₹500, 50% -> ₹1000, 25% -> ₹1500, 0% -> ₹2000).
 * 3. Damage charge:
 *    - Excellent / Good: ₹0.
 *    - Minor Damage: ₹1,500.
 *    - Major Damage: ₹5,000.
 *
 * Settlement Formulas:
 * Total Additional Charges = Distance Charge + Fuel Charge + Damage Charge
 * Final Rental Amount = Original Rental Amount + Total Additional Charges
 * Deposit Deduction = Minimum of Available Deposit and Total Additional Charges
 * Remaining Refund = Available Deposit - Deposit Deduction
 * Remaining Balance = Total Additional Charges > Available Deposit ? (Total Additional Charges - Available Deposit) : 0
 */
export function calculateSettlementCharges({
  originalRentalAmount = 0,
  securityDepositAmount = 0,
  totalDays = 1,
  distanceTravelled = 0,
  endingFuelPercent = 100,
  vehicleCondition = 'Good'
}) {
  const origRental = Math.max(0, Math.round(Number(originalRentalAmount || 0) * 100) / 100)
  const availableDeposit = Math.max(0, Math.round(Number(securityDepositAmount || 0) * 100) / 100)

  // 1. Distance Calculation
  const days = Math.max(1, Math.ceil(Number(totalDays || 1)))
  const includedDistanceKm = days * 150
  const actualDistance = Math.max(0, Math.round(Number(distanceTravelled || 0)))
  const extraDistanceKm = Math.max(0, actualDistance - includedDistanceKm)
  const ratePerKm = 12.0
  const extraDistanceCharge = Math.round(extraDistanceKm * ratePerKm * 100) / 100

  // 2. Fuel Refill Calculation
  const fuelPercent = Math.max(0, Math.min(100, Math.round(Number(endingFuelPercent ?? 100))))
  const missingPercent = Math.max(0, 100 - fuelPercent)
  let fuelRefillCharge = 0.0
  if (missingPercent > 0) {
    fuelRefillCharge = Math.round((missingPercent / 100) * 2000 * 100) / 100
  }

  // 3. Damage Charge Calculation
  const condNorm = String(vehicleCondition || 'good')
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, '_')

  let damageCharge = 0.0
  let conditionLabel = 'Good'

  if (condNorm === 'excellent') {
    damageCharge = 0.0
    conditionLabel = 'Excellent'
  } else if (condNorm === 'good') {
    damageCharge = 0.0
    conditionLabel = 'Good'
  } else if (condNorm === 'minor_damage') {
    damageCharge = 1500.0
    conditionLabel = 'Minor Damage'
  } else if (condNorm === 'major_damage') {
    damageCharge = 5000.0
    conditionLabel = 'Major Damage'
  } else {
    // Default safe fallback
    damageCharge = 0.0
    conditionLabel = vehicleCondition || 'Good'
  }

  // Formulas
  const totalAdditionalCharges = Math.round(
    (extraDistanceCharge + fuelRefillCharge + damageCharge) * 100
  ) / 100

  const finalRentalAmount = Math.round((origRental + totalAdditionalCharges) * 100) / 100

  const depositDeduction = Math.min(availableDeposit, totalAdditionalCharges)
  const remainingRefund = Math.max(
    0,
    Math.round((availableDeposit - depositDeduction) * 100) / 100
  )
  const remainingBalance =
    totalAdditionalCharges > availableDeposit
      ? Math.round((totalAdditionalCharges - availableDeposit) * 100) / 100
      : 0.0

  return {
    original_rental_amount: origRental,
    security_deposit_amount: availableDeposit,
    total_days: days,
    distance_travelled: actualDistance,
    included_distance_km: includedDistanceKm,
    extra_distance_km: extraDistanceKm,
    rate_per_extra_km: ratePerKm,
    extra_distance_charge: extraDistanceCharge,
    ending_fuel_percent: fuelPercent,
    fuel_refill_charge: fuelRefillCharge,
    vehicle_condition: conditionLabel,
    damage_charge: damageCharge,
    total_additional_charges: totalAdditionalCharges,
    final_rental_amount: finalRentalAmount,
    deposit_deduction: depositDeduction,
    remaining_refund: remainingRefund,
    remaining_balance: remainingBalance,
    academic_disclaimer: 'SAMPLE – COLLEGE PROJECT DEMONSTRATION – NO REAL PAYMENT OR REFUND PROCESSED'
  }
}

/**
 * Helper to get a valid staff ID
 */
async function resolveStaffId(connection, candidateId) {
  if (candidateId) {
    const [rows] = await connection.query('SELECT id FROM staff WHERE id = ? LIMIT 1', [candidateId])
    if (rows.length > 0) return rows[0].id
  }
  const [firstStaff] = await connection.query('SELECT id FROM staff ORDER BY id ASC LIMIT 1')
  return firstStaff.length > 0 ? firstStaff[0].id : 1
}

/**
 * Preview Settlement Calculations for a booking (Admin/Staff)
 * GET /api/v1/settlements/booking/:bookingId/preview
 */
export const previewSettlement = async (req, res) => {
  await ensureSettlementsTable()

  const bookingId = Number(req.params.bookingId)
  if (!bookingId || isNaN(bookingId)) {
    return sendError(res, 'Valid booking ID is required.', 400)
  }

  try {
    // 1. Fetch booking details
    const [bookingRows] = await pool.query(
      `SELECT b.id, b.booking_reference, b.customer_id, b.vehicle_id, b.booking_status,
              b.start_date, b.end_date, b.total_days, b.base_rental_amount,
              b.security_deposit_amount, b.total_amount,
              c.first_name, c.last_name, c.email, c.phone,
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

    // 2. Fetch Handover & Return records
    const [handoverRows] = await pool.query(
      'SELECT id, odometer_reading, fuel_level_percent, handover_datetime FROM rental_handover WHERE booking_id = ?',
      [bookingId]
    )
    const handover = handoverRows[0] || null

    const [returnRows] = await pool.query(
      `SELECT rr.id, rr.odometer_reading, rr.fuel_level_percent, rr.return_condition_notes,
              rr.damages_identified, rr.inspection_status, rr.return_datetime,
              s.first_name AS staff_first_name, s.last_name AS staff_last_name
       FROM rental_returns rr
       LEFT JOIN staff s ON rr.staff_id = s.id
       WHERE rr.booking_id = ?`,
      [bookingId]
    )

    if (returnRows.length === 0) {
      return sendError(
        res,
        'Vehicle return and inspection must be recorded before previewing final settlement.',
        400
      )
    }

    const returnRecord = returnRows[0]

    // Check if settlement already exists
    const [existingSettlement] = await pool.query(
      'SELECT * FROM rental_settlements WHERE booking_id = ?',
      [bookingId]
    )

    const startOdo = handover ? Number(handover.odometer_reading) : 0
    const endOdo = Number(returnRecord.odometer_reading)
    const distanceTravelled = endOdo >= startOdo ? endOdo - startOdo : 0

    // Extract condition from notes if available
    let extractedCondition = 'Good'
    if (returnRecord.return_condition_notes) {
      const match = returnRecord.return_condition_notes.match(/\[Condition:\s*([^\]]+)\]/)
      if (match) {
        extractedCondition = match[1].trim()
      }
    }

    // Calculate settlement
    const calculation = calculateSettlementCharges({
      originalRentalAmount: Number(booking.base_rental_amount || 0),
      securityDepositAmount: Number(booking.security_deposit_amount || 0),
      totalDays: Number(booking.total_days || 1),
      distanceTravelled,
      endingFuelPercent: returnRecord.fuel_level_percent,
      vehicleCondition: extractedCondition
    })

    return sendSuccess(res, 'Settlement calculation preview generated.', {
      is_settled: existingSettlement.length > 0,
      settlement_record: existingSettlement[0] || null,
      preview: calculation,
      booking: {
        id: booking.id,
        booking_reference: booking.booking_reference,
        booking_status: booking.booking_status,
        customer_name: `${booking.first_name} ${booking.last_name}`,
        customer_email: booking.email,
        start_date: booking.start_date,
        end_date: booking.end_date,
        vehicle: {
          make: booking.make,
          model: booking.model,
          registration_number: booking.registration_number,
          availability_status: booking.availability_status
        }
      },
      return_summary: {
        return_datetime: returnRecord.return_datetime,
        starting_odometer: startOdo,
        ending_odometer: endOdo,
        distance_travelled: distanceTravelled,
        ending_fuel_percent: returnRecord.fuel_level_percent,
        vehicle_condition: extractedCondition,
        inspected_by: returnRecord.staff_first_name
          ? `${returnRecord.staff_first_name} ${returnRecord.staff_last_name}`
          : 'Staff'
      }
    })
  } catch (err) {
    console.error('previewSettlement error:', err)
    return sendError(res, 'Failed to generate settlement preview.', 500)
  }
}

/**
 * Confirm Final Settlement & Close Rental (Admin/Staff only)
 * POST /api/v1/settlements/confirm or POST /api/v1/settlements
 *
 * Steps in one atomic transaction:
 * 1. Lock booking (FOR UPDATE) - check status is 'active' (or valid).
 * 2. Lock vehicle (FOR UPDATE).
 * 3. Lock return record (FOR UPDATE) - require return inspection.
 * 4. Lock & check settlement record (FOR UPDATE) - reject duplicate (409).
 * 5. Calculate settlement amounts strictly on backend.
 * 6. Insert rental_settlements record.
 * 7. Insert items into additional_charges table for audit.
 * 8. Update booking_status = 'completed'.
 * 9. Update vehicle availability_status:
 *    - If other active booking exists => 'rented'
 *    - Else if other confirmed booking exists => 'booked'
 *    - Else if vehicle was ('rented', 'booked') => 'available'
 *    - Preserve 'maintenance' and 'decommissioned'
 * 10. Commit transaction.
 */
export const confirmSettlement = async (req, res) => {
  await ensureSettlementsTable()

  const { booking_id, settlement_notes = '' } = req.body

  if (!booking_id || isNaN(Number(booking_id))) {
    return sendError(res, 'Valid booking ID is required.', 400)
  }

  const staffIdFromAuth = req.staff?.id || req.user?.id || null

  try {
    const result = await withDeadlockRetry(async () => {
      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()

        // 1. Lock booking row
        const [bookingRows] = await connection.query(
          `SELECT id, booking_reference, customer_id, vehicle_id, booking_status,
                  start_date, end_date, total_days, base_rental_amount,
                  security_deposit_amount, total_amount
           FROM bookings
           WHERE id = ?
           FOR UPDATE`,
          [booking_id]
        )

        if (bookingRows.length === 0) {
          await connection.rollback()
          const err = new Error('Booking not found.')
          err.statusCode = 404
          throw err
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
          const err = new Error('Associated vehicle not found.')
          err.statusCode = 404
          throw err
        }

        const vehicle = vehicleRows[0]

        // 3. Duplicate settlement check
        const [existingSettlements] = await connection.query(
          `SELECT id, settlement_status, final_rental_amount, settled_at
           FROM rental_settlements
           WHERE booking_id = ?
           FOR UPDATE`,
          [booking_id]
        )

        if (existingSettlements.length > 0) {
          await connection.rollback()
          const err = new Error('Final settlement has already been completed for this booking.')
          err.statusCode = 409
          throw err
        }

        // 4. Validate booking status eligibility
        if (booking.booking_status === 'completed') {
          await connection.rollback()
          const err = new Error('Booking is already completed and closed.')
          err.statusCode = 400
          throw err
        }

        if (booking.booking_status !== 'active') {
          await connection.rollback()
          const err = new Error(
            `Final settlement can only be processed for active rentals with completed return inspection (current status: '${booking.booking_status}').`
          )
          err.statusCode = 400
          throw err
        }

        // 5. Require completed vehicle return inspection
        const [returnRows] = await connection.query(
          `SELECT id, odometer_reading, fuel_level_percent, return_condition_notes,
                  damages_identified, inspection_status, return_datetime
           FROM rental_returns
           WHERE booking_id = ?
           FOR UPDATE`,
          [booking_id]
        )

        if (returnRows.length === 0) {
          await connection.rollback()
          const err = new Error(
            'Vehicle return and inspection must be completed before final settlement and rental closure.'
          )
          err.statusCode = 400
          throw err
        }

        const returnRecord = returnRows[0]

        // 6. Fetch handover record for starting odometer
        const [handoverRows] = await connection.query(
          `SELECT id, odometer_reading, fuel_level_percent FROM rental_handover WHERE booking_id = ?`,
          [booking_id]
        )
        const handover = handoverRows[0] || null
        const startOdo = handover ? Number(handover.odometer_reading) : 0
        const endOdo = Number(returnRecord.odometer_reading)
        const distanceTravelled = endOdo >= startOdo ? endOdo - startOdo : 0

        // Extract condition from notes
        let extractedCondition = 'Good'
        if (returnRecord.return_condition_notes) {
          const match = returnRecord.return_condition_notes.match(/\[Condition:\s*([^\]]+)\]/)
          if (match) {
            extractedCondition = match[1].trim()
          }
        }

        // 7. Calculate final settlement amounts strictly on backend
        const calc = calculateSettlementCharges({
          originalRentalAmount: Number(booking.base_rental_amount || 0),
          securityDepositAmount: Number(booking.security_deposit_amount || 0),
          totalDays: Number(booking.total_days || 1),
          distanceTravelled,
          endingFuelPercent: returnRecord.fuel_level_percent,
          vehicleCondition: extractedCondition
        })

        const validStaffId = await resolveStaffId(connection, staffIdFromAuth)
        const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ')

        // 8. Persist rental_settlements record
        const insertSettlementSql = `
          INSERT INTO rental_settlements (
            booking_id,
            settled_by_staff_id,
            original_rental_amount,
            distance_travelled,
            included_distance_km,
            extra_distance_km,
            extra_distance_charge,
            ending_fuel_percent,
            fuel_refill_charge,
            vehicle_condition,
            damage_charge,
            total_additional_charges,
            final_rental_amount,
            security_deposit_amount,
            deposit_deduction,
            remaining_refund,
            remaining_balance,
            settlement_status,
            settlement_notes,
            academic_disclaimer,
            settled_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'settled', ?, ?, ?)
        `
        const [insertResult] = await connection.query(insertSettlementSql, [
          booking_id,
          validStaffId,
          calc.original_rental_amount,
          calc.distance_travelled,
          calc.included_distance_km,
          calc.extra_distance_km,
          calc.extra_distance_charge,
          calc.ending_fuel_percent,
          calc.fuel_refill_charge,
          calc.vehicle_condition,
          calc.damage_charge,
          calc.total_additional_charges,
          calc.final_rental_amount,
          calc.security_deposit_amount,
          calc.deposit_deduction,
          calc.remaining_refund,
          calc.remaining_balance,
          settlement_notes ? String(settlement_notes).trim() : null,
          calc.academic_disclaimer,
          nowStr
        ])

        // 9. Persist itemized charges in additional_charges table for audit
        const chargePaymentStatus =
          calc.security_deposit_amount > 0 ? 'deducted_from_deposit' : 'paid'

        if (calc.extra_distance_charge > 0) {
          await connection.query(
            `INSERT INTO additional_charges (booking_id, charge_type, amount, description, assessed_by_staff_id, payment_status)
             VALUES (?, 'extra_km', ?, ?, ?, ?)`,
            [
              booking_id,
              calc.extra_distance_charge,
              `Extra distance: ${calc.extra_distance_km} km @ ₹${calc.rate_per_extra_km}/km (Included: ${calc.included_distance_km} km)`,
              validStaffId,
              chargePaymentStatus
            ]
          )
        }

        if (calc.fuel_refill_charge > 0) {
          await connection.query(
            `INSERT INTO additional_charges (booking_id, charge_type, amount, description, assessed_by_staff_id, payment_status)
             VALUES (?, 'fuel_refill', ?, ?, ?, ?)`,
            [
              booking_id,
              calc.fuel_refill_charge,
              `Fuel refill adjustment: ending fuel ${calc.ending_fuel_percent}%`,
              validStaffId,
              chargePaymentStatus
            ]
          )
        }

        if (calc.damage_charge > 0) {
          await connection.query(
            `INSERT INTO additional_charges (booking_id, charge_type, amount, description, assessed_by_staff_id, payment_status)
             VALUES (?, 'damage', ?, ?, ?, ?)`,
            [
              booking_id,
              calc.damage_charge,
              `Vehicle condition assessment: ${calc.vehicle_condition}`,
              validStaffId,
              chargePaymentStatus
            ]
          )
        }

        // 10. Update booking status to 'completed'
        await connection.query(
          `UPDATE bookings
           SET booking_status = 'completed',
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [booking_id]
        )

        // 11. Update vehicle availability safely (booking lifecycle rules)
        const [otherBookings] = await connection.query(
          `SELECT id, booking_reference, booking_status, start_date, end_date
           FROM bookings
           WHERE vehicle_id = ?
             AND booking_status IN ('confirmed', 'active')
             AND id != ?
           ORDER BY start_date ASC
           FOR UPDATE`,
          [vehicleId, booking_id]
        )

        let nextVehicleStatus = vehicle.availability_status
        const hasActiveBooking = otherBookings.some((b) => b.booking_status === 'active')
        const hasConfirmedBooking = otherBookings.some((b) => b.booking_status === 'confirmed')

        if (hasActiveBooking) {
          nextVehicleStatus = 'rented'
          if (!['maintenance', 'decommissioned'].includes(vehicle.availability_status)) {
            await connection.query(
              `UPDATE vehicles SET availability_status = 'rented', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
              [vehicleId]
            )
          }
        } else if (hasConfirmedBooking) {
          nextVehicleStatus = 'booked'
          if (!['maintenance', 'decommissioned'].includes(vehicle.availability_status)) {
            await connection.query(
              `UPDATE vehicles SET availability_status = 'booked', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
              [vehicleId]
            )
          }
        } else {
          // No other active or confirmed bookings exist!
          if (['booked', 'rented'].includes(vehicle.availability_status)) {
            nextVehicleStatus = 'available'
            await connection.query(
              `UPDATE vehicles SET availability_status = 'available', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
              [vehicleId]
            )
          }
        }

        await connection.commit()

        return {
          settlement_id: insertResult.insertId,
          booking_id,
          booking_reference: booking.booking_reference,
          booking_status: 'completed',
          vehicle_id: vehicleId,
          vehicle_availability: nextVehicleStatus,
          settled_at: nowStr,
          settlement: {
            id: insertResult.insertId,
            ...calc,
            settlement_notes: settlement_notes || null,
            settled_at: nowStr
          }
        }
      } catch (err) {
        await connection.rollback()
        throw err
      } finally {
        connection.release()
      }
    })

    return sendSuccess(
      res,
      'Final settlement confirmed and rental closed successfully.',
      result,
      201
    )
  } catch (err) {
    const status = err.statusCode || 500
    return sendError(res, err.message || 'Failed to confirm final settlement.', status)
  }
}

/**
 * Retrieve Settlement Details for a Booking (Customer or Staff)
 * GET /api/v1/settlements/booking/:bookingId
 */
export const getSettlementByBooking = async (req, res) => {
  await ensureSettlementsTable()

  const bookingId = Number(req.params.bookingId)
  if (!bookingId || isNaN(bookingId)) {
    return sendError(res, 'Valid booking ID is required.', 400)
  }

  try {
    // 1. Fetch booking
    const [bookingRows] = await pool.query(
      `SELECT b.id, b.booking_reference, b.customer_id, b.vehicle_id, b.booking_status,
              b.start_date, b.end_date, b.total_days, b.base_rental_amount,
              b.security_deposit_amount, b.total_amount,
              c.first_name, c.last_name, c.email, c.phone,
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

    // 2. Customer authorization check: customers can only view their own bookings
    if (req.customer && !req.staff) {
      if (Number(booking.customer_id) !== Number(req.customer.id)) {
        return sendError(
          res,
          'You are not authorized to view settlement details for this booking.',
          403
        )
      }
    }

    // 3. Fetch settlement record if exists
    const [settlementRows] = await pool.query(
      `SELECT rs.*, s.first_name AS staff_first_name, s.last_name AS staff_last_name
       FROM rental_settlements rs
       LEFT JOIN staff s ON rs.settled_by_staff_id = s.id
       WHERE rs.booking_id = ?`,
      [bookingId]
    )

    const isSettled = settlementRows.length > 0
    const settlement = isSettled ? settlementRows[0] : null

    // 4. Fetch Handover & Return summary
    const [handoverRows] = await pool.query(
      'SELECT id, odometer_reading, fuel_level_percent, handover_datetime FROM rental_handover WHERE booking_id = ?',
      [bookingId]
    )
    const handover = handoverRows[0] || null

    const [returnRows] = await pool.query(
      `SELECT rr.id, rr.odometer_reading, rr.fuel_level_percent, rr.return_condition_notes,
              rr.damages_identified, rr.inspection_status, rr.return_datetime,
              s.first_name AS staff_first_name, s.last_name AS staff_last_name
       FROM rental_returns rr
       LEFT JOIN staff s ON rr.staff_id = s.id
       WHERE rr.booking_id = ?`,
      [bookingId]
    )
    const returnRecord = returnRows[0] || null

    return sendSuccess(res, 'Settlement details retrieved.', {
      is_settled: isSettled,
      settlement_data: settlement
        ? {
            id: settlement.id,
            booking_id: settlement.booking_id,
            settled_by: settlement.staff_first_name
              ? `${settlement.staff_first_name} ${settlement.staff_last_name}`
              : 'Staff',
            original_rental_amount: Number(settlement.original_rental_amount),
            distance_travelled: Number(settlement.distance_travelled),
            included_distance_km: Number(settlement.included_distance_km),
            extra_distance_km: Number(settlement.extra_distance_km),
            extra_distance_charge: Number(settlement.extra_distance_charge),
            ending_fuel_percent: Number(settlement.ending_fuel_percent),
            fuel_refill_charge: Number(settlement.fuel_refill_charge),
            vehicle_condition: settlement.vehicle_condition,
            damage_charge: Number(settlement.damage_charge),
            total_additional_charges: Number(settlement.total_additional_charges),
            final_rental_amount: Number(settlement.final_rental_amount),
            security_deposit_amount: Number(settlement.security_deposit_amount),
            deposit_deduction: Number(settlement.deposit_deduction),
            remaining_refund: Number(settlement.remaining_refund),
            remaining_balance: Number(settlement.remaining_balance),
            settlement_status: settlement.settlement_status,
            settlement_notes: settlement.settlement_notes,
            academic_disclaimer: settlement.academic_disclaimer,
            settled_at: settlement.settled_at
          }
        : null,
      booking: {
        id: booking.id,
        booking_reference: booking.booking_reference,
        booking_status: booking.booking_status,
        customer_name: `${booking.first_name} ${booking.last_name}`,
        customer_email: booking.email,
        start_date: booking.start_date,
        end_date: booking.end_date,
        total_days: Number(booking.total_days || 1),
        base_rental_amount: Number(booking.base_rental_amount || 0),
        security_deposit_amount: Number(booking.security_deposit_amount || 0),
        vehicle: {
          make: booking.make,
          model: booking.model,
          registration_number: booking.registration_number,
          availability_status: booking.availability_status
        }
      },
      return_record: returnRecord
        ? {
            id: returnRecord.id,
            return_datetime: returnRecord.return_datetime,
            odometer_reading: Number(returnRecord.odometer_reading),
            fuel_level_percent: Number(returnRecord.fuel_level_percent),
            inspection_status: returnRecord.inspection_status
          }
        : null
    })
  } catch (err) {
    console.error('getSettlementByBooking error:', err)
    return sendError(res, 'Failed to retrieve settlement details.', 500)
  }
}

/**
 * List all settlements for Admin/Staff
 * GET /api/v1/settlements/admin/list
 */
export const getAdminSettlementsList = async (req, res) => {
  await ensureSettlementsTable()

  try {
    const [rows] = await pool.query(
      `SELECT rs.*, b.booking_reference, b.booking_status,
              c.first_name AS customer_first_name, c.last_name AS customer_last_name,
              v.make, v.model, v.registration_number,
              s.first_name AS staff_first_name, s.last_name AS staff_last_name
       FROM rental_settlements rs
       JOIN bookings b ON rs.booking_id = b.id
       JOIN customers c ON b.customer_id = c.id
       JOIN vehicles v ON b.vehicle_id = v.id
       LEFT JOIN staff s ON rs.settled_by_staff_id = s.id
       ORDER BY rs.settled_at DESC
       LIMIT 50`
    )

    return sendSuccess(res, 'Settlement records retrieved.', rows)
  } catch (err) {
    console.error('getAdminSettlementsList error:', err)
    return sendError(res, 'Failed to retrieve settlements list.', 500)
  }
}
