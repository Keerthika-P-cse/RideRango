import pool from '../config/db.js'
import { enrichVehicleData } from './vehicleService.js'
import { withDeadlockRetry } from '../utils/dbTransactionHelper.js'

/**
 * Calculate 100% full demo refund equal to the actual paid amount.
 * No cancellation deductions or partial refunds are applied.
 */
export const calculateFullDemoRefund = (paidAmount) => {
  const parsed = Number(paidAmount)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0
  }
  return Math.round(parsed * 100) / 100
}

/**
 * Helper to generate unique booking reference: RR-BK-XXXXXX
 */
const generateBookingReference = () => {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.floor(1000 + Math.random() * 9000)
  return `RR-BK-${timestamp}-${random}`
}

const BLOCKED_AVAILABILITY_LABELS = {
  booked: 'Already Booked',
  rented: 'Currently Rented',
  maintenance: 'Under Maintenance',
  unavailable: 'Unavailable',
  out_of_stock: 'Out of Stock',
  decommissioned: 'Decommissioned'
}

const getUnavailableReason = (status) => {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'available') return null
  const label = BLOCKED_AVAILABILITY_LABELS[normalized] || normalized || 'Unavailable'
  return `This vehicle is currently ${label} (${normalized || 'unavailable'}) and cannot be booked at this time.`
}

export const bookingService = {
  /**
   * Check if a specific vehicle is available for requested datetime range
   */
  async checkAvailability(vehicleId, startDate, endDate, excludeBookingId = null) {
    if (!vehicleId || !startDate || !endDate) {
      throw new Error('Vehicle ID, start date, and end date are required.')
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format provided.')
    }

    if (end <= start) {
      throw new Error('Return date and time must be after pickup date and time.')
    }

    // Verify vehicle exists and is active in database
    const [vehicles] = await pool.query(
      `SELECT id, make, model, registration_number, daily_rate, security_deposit, availability_status, is_active 
       FROM vehicles 
       WHERE id = ?`,
      [vehicleId]
    )

    if (vehicles.length === 0 || !vehicles[0].is_active) {
      return {
        available: false,
        reason: 'This vehicle is not active in the rental fleet.',
        vehicle: null
      }
    }

    const vehicle = vehicles[0]
    const blockedReason = getUnavailableReason(vehicle.availability_status)
    if (blockedReason) {
      return {
        available: false,
        reason: blockedReason,
        vehicle
      }
    }

    // Check overlapping bookings in database
    let conflictQuery = `
      SELECT id, booking_reference, start_date, end_date, booking_status 
      FROM bookings 
      WHERE vehicle_id = ? 
        AND booking_status IN ('pending', 'confirmed', 'active')
        AND start_date < ? 
        AND end_date > ?
    `
    const params = [vehicleId, end, start]

    if (excludeBookingId) {
      conflictQuery += ' AND id != ?'
      params.push(excludeBookingId)
    }

    const [conflicts] = await pool.query(conflictQuery, params)

    if (conflicts.length > 0) {
      return {
        available: false,
        reason: 'Vehicle is already reserved for the selected dates.',
        vehicle,
        conflictingBooking: conflicts[0]
      }
    }

    return {
      available: true,
      reason: 'Vehicle is available for the selected dates.',
      vehicle
    }
  },

  /**
   * Get upcoming/active booked date ranges for a vehicle without exposing customer PII
   */
  async getBookedDates(vehicleId, dbPool = pool) {
    if (!vehicleId) {
      throw new Error('Vehicle ID is required.')
    }

    const [vehicles] = await dbPool.query(
      `SELECT id, availability_status, is_active
       FROM vehicles
       WHERE id = ?`,
      [vehicleId]
    )

    if (vehicles.length === 0 || !vehicles[0].is_active) {
      throw new Error('Vehicle not found or inactive.')
    }

    const [bookedRanges] = await dbPool.query(
      `SELECT start_date, end_date, booking_status
       FROM bookings
       WHERE vehicle_id = ?
         AND booking_status IN ('pending', 'confirmed', 'active')
         AND end_date >= NOW()
       ORDER BY start_date ASC`,
      [vehicleId]
    )

    return {
      vehicleId: vehicles[0].id,
      availability_status: vehicles[0].availability_status,
      bookedRanges: bookedRanges.map((r) => ({
        start_date: r.start_date,
        end_date: r.end_date,
        booking_status: r.booking_status
      }))
    }
  },

  /**
   * Create a new genuine booking record in MySQL with safe transaction
   */
  async createBooking(customerId, bookingData) {
    const {
      vehicle_id,
      start_date,
      end_date,
      pickup_location,
      dropoff_location,
      customer_notes,
      driving_license_number,
      phone
    } = bookingData

    if (!vehicle_id || !start_date || !end_date) {
      throw new Error('Vehicle, pickup date, and return date are required.')
    }

    const start = new Date(start_date)
    const end = new Date(end_date)
    const now = new Date()

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid pickup or return date.')
    }

    if (start < new Date(now.getTime() - 15 * 60 * 1000)) {
      throw new Error('Pickup date and time cannot be in the past.')
    }

    if (end <= start) {
      throw new Error('Return date and time must be after pickup date and time.')
    }

    // Calculate rental days (minimum 1 day)
    const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
    const totalDays = Math.max(1, Math.ceil(diffHours / 24))

    return withDeadlockRetry(async () => {
      const connection = await pool.getConnection()

      try {
        await connection.beginTransaction()

      // 1. Fetch vehicle with lock to prevent race condition
      const [vehicles] = await connection.query(
        `SELECT id, make, model, registration_number, daily_rate, security_deposit, availability_status, location, is_active 
         FROM vehicles 
         WHERE id = ? FOR UPDATE`,
        [vehicle_id]
      )

      if (vehicles.length === 0 || !vehicles[0].is_active) {
        throw new Error('Selected vehicle does not exist or is inactive in the database fleet.')
      }

      const vehicle = vehicles[0]

      const blockedReason = getUnavailableReason(vehicle.availability_status)
      if (blockedReason) {
        throw new Error(blockedReason)
      }

      // 2. Strict overlap check inside transaction
      const [conflicts] = await connection.query(
        `SELECT id, booking_reference 
         FROM bookings 
         WHERE vehicle_id = ? 
           AND booking_status IN ('pending', 'confirmed', 'active')
           AND start_date < ? 
           AND end_date > ? 
         FOR UPDATE`,
        [vehicle_id, end, start]
      )

      if (conflicts.length > 0) {
        throw new Error('This vehicle has just been reserved by another customer for these dates. Please choose another vehicle or time.')
      }

      // 3. Update customer details (license/phone) if provided
      if (driving_license_number || phone) {
        await connection.query(
          `UPDATE customers 
           SET driving_license_number = COALESCE(?, driving_license_number),
               phone = COALESCE(?, phone)
           WHERE id = ?`,
          [driving_license_number || null, phone || null, customerId]
        )
      }

      // 4. Calculate prices on the server using trusted database information
      const rentalRatePerDay = parseFloat(vehicle.daily_rate)
      const baseRentalAmount = rentalRatePerDay * totalDays
      const securityDepositAmount = parseFloat(vehicle.security_deposit || 0)
      const totalAmount = baseRentalAmount + securityDepositAmount

      const bookingReference = generateBookingReference()
      const pickupLoc = pickup_location || vehicle.location || 'Main Hub - Indiranagar'
      const dropoffLoc = dropoff_location || pickupLoc

      // 5. Insert booking record
      const [insertResult] = await connection.query(
        `INSERT INTO bookings 
         (booking_reference, customer_id, vehicle_id, start_date, end_date, pickup_location, dropoff_location, 
          total_days, rental_rate_per_day, base_rental_amount, security_deposit_amount, total_amount, booking_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          bookingReference,
          customerId,
          vehicle.id,
          start,
          end,
          pickupLoc,
          dropoffLoc,
          totalDays,
          rentalRatePerDay,
          baseRentalAmount,
          securityDepositAmount,
          totalAmount
        ]
      )

      const bookingId = insertResult.insertId

      await connection.commit()

      return {
        id: bookingId,
        booking_reference: bookingReference,
        customer_id: customerId,
        vehicle_id: vehicle.id,
        vehicle_name: `${vehicle.make} ${vehicle.model}`,
        registration_number: vehicle.registration_number,
        start_date: start,
        end_date: end,
        pickup_location: pickupLoc,
        dropoff_location: dropoffLoc,
        total_days: totalDays,
        rental_rate_per_day: rentalRatePerDay,
        base_rental_amount: baseRentalAmount,
        security_deposit_amount: securityDepositAmount,
        total_amount: totalAmount,
        booking_status: 'pending'
      }
      } catch (err) {
        await connection.rollback()
        throw err
      } finally {
        connection.release()
      }
    })
  },

  /**
   * Get single booking by ID with security verification
   */
  async getBookingById(bookingId, customerId, dbPool = pool) {
    const [rows] = await dbPool.query(
      `SELECT b.*, 
              v.make, v.model, v.registration_number, v.color, v.fuel_type, v.transmission, 
              v.seating_capacity, v.features_json,
              vc.name as category_name, vc.slug as category_slug,
              c.first_name, c.last_name, c.email, c.phone, c.driving_license_number,
              p.transaction_reference, p.gateway_transaction_id, p.payment_notes, p.payment_status, p.payment_method, p.paid_at, p.amount as paid_amount,
              r.transaction_reference as refund_reference, r.payment_status as refund_status,
              r.amount as refund_amount, r.paid_at as refunded_at, r.payment_notes as refund_notes
       FROM bookings b
       JOIN vehicles v ON b.vehicle_id = v.id
       JOIN vehicle_categories vc ON v.category_id = vc.id
       JOIN customers c ON b.customer_id = c.id
       LEFT JOIN (
         SELECT p1.booking_id, p1.transaction_reference, p1.gateway_transaction_id, p1.payment_notes, p1.payment_status, p1.payment_method, p1.paid_at, p1.amount
         FROM payments p1
         INNER JOIN (
           SELECT booking_id, MAX(id) as max_id
           FROM payments
           WHERE payment_status = 'success' AND payment_type != 'refund'
           GROUP BY booking_id
         ) p2 ON p1.id = p2.max_id
       ) p ON p.booking_id = b.id
       LEFT JOIN (
         SELECT r1.booking_id, r1.transaction_reference, r1.payment_status, r1.amount, r1.paid_at, r1.payment_notes
         FROM payments r1
         INNER JOIN (
           SELECT booking_id, MAX(id) as max_id
           FROM payments
           WHERE payment_type = 'refund'
           GROUP BY booking_id
         ) r2 ON r1.id = r2.max_id
       ) r ON r.booking_id = b.id
       WHERE b.id = ? AND b.customer_id = ?`,
      [bookingId, customerId]
    )

    if (rows.length === 0) {
      throw new Error('Booking not found or you are not authorized to view it.')
    }

    return enrichVehicleData(rows[0])
  },

  /**
   * Get all bookings for authenticated customer
   */
  async getCustomerBookings(customerId, dbPool = pool) {
    const [rows] = await dbPool.query(
      `SELECT b.*, 
              v.make, v.model, v.registration_number, v.fuel_type, v.transmission,
              vc.name as category_name, vc.slug as category_slug,
              p.transaction_reference, p.gateway_transaction_id, p.payment_notes, p.payment_status, p.payment_method, p.paid_at, p.amount as paid_amount,
              r.transaction_reference as refund_reference, r.payment_status as refund_status,
              r.amount as refund_amount, r.paid_at as refunded_at, r.payment_notes as refund_notes
       FROM bookings b
       JOIN vehicles v ON b.vehicle_id = v.id
       JOIN vehicle_categories vc ON v.category_id = vc.id
       LEFT JOIN (
         SELECT p1.booking_id, p1.transaction_reference, p1.gateway_transaction_id, p1.payment_notes, p1.payment_status, p1.payment_method, p1.paid_at, p1.amount
         FROM payments p1
         INNER JOIN (
           SELECT booking_id, MAX(id) as max_id
           FROM payments
           WHERE payment_status = 'success' AND payment_type != 'refund'
           GROUP BY booking_id
         ) p2 ON p1.id = p2.max_id
       ) p ON p.booking_id = b.id
       LEFT JOIN (
         SELECT r1.booking_id, r1.transaction_reference, r1.payment_status, r1.amount, r1.paid_at, r1.payment_notes
         FROM payments r1
         INNER JOIN (
           SELECT booking_id, MAX(id) as max_id
           FROM payments
           WHERE payment_type = 'refund'
           GROUP BY booking_id
         ) r2 ON r1.id = r2.max_id
       ) r ON r.booking_id = b.id
       WHERE b.customer_id = ?
       ORDER BY b.created_at DESC`,
      [customerId]
    )

    return rows.map((r) => enrichVehicleData(r))
  },

  /**
   * Cancel customer booking according to business rules and process 100% DEMO refund if paid
   */
  async cancelBooking(bookingId, customerId, reason = '', dbPool = pool) {
    return withDeadlockRetry(async () => {
      const connection = await dbPool.getConnection()

      try {
        await connection.beginTransaction()

      // Resolve vehicle_id first so we can acquire locks in consistent order (vehicles -> bookings -> payments)
      const [lookupRows] = await connection.query(
        `SELECT vehicle_id 
         FROM bookings 
         WHERE id = ? AND customer_id = ?`,
        [bookingId, customerId]
      )

      if (lookupRows.length === 0) {
        throw new Error('Booking not found or not owned by you.')
      }

      const [vehicleRows] = await connection.query(
        `SELECT id, availability_status 
         FROM vehicles 
         WHERE id = ? 
         FOR UPDATE`,
        [lookupRows[0].vehicle_id]
      )

      const [rows] = await connection.query(
        `SELECT * 
         FROM bookings 
         WHERE id = ? AND customer_id = ? 
         FOR UPDATE`,
        [bookingId, customerId]
      )

      if (rows.length === 0) {
        throw new Error('Booking not found or not owned by you.')
      }

      const booking = rows[0]
      const vehicle = vehicleRows[0] || null

      if (booking.booking_status === 'cancelled') {
        throw new Error('This booking has already been cancelled.')
      }

      if (booking.booking_status === 'completed' || booking.booking_status === 'active') {
        throw new Error('Active or completed rentals cannot be cancelled.')
      }

      // Check if start date is in the past
      if (new Date(booking.start_date) <= new Date()) {
        throw new Error('Bookings cannot be cancelled after the scheduled pickup time.')
      }

      const normalizedReason = reason ? reason.trim() : 'Customer requested cancellation'

      // Update booking status to cancelled
      await connection.query(
        `UPDATE bookings 
         SET booking_status = 'cancelled', 
             cancellation_reason = ? 
         WHERE id = ?`,
        [normalizedReason, bookingId]
      )

      // Only restore vehicle availability if currently 'booked' and no other confirmed/active booking exists
      if (vehicle && vehicle.availability_status === 'booked') {
        const [otherActiveBookings] = await connection.query(
          `SELECT id 
           FROM bookings 
           WHERE vehicle_id = ? 
             AND booking_status IN ('confirmed', 'active') 
             AND id != ? 
           LIMIT 1 
           FOR UPDATE`,
          [booking.vehicle_id, bookingId]
        )

        if (otherActiveBookings.length === 0) {
          await connection.query(
            `UPDATE vehicles 
             SET availability_status = 'available' 
             WHERE id = ? AND availability_status = 'booked'`,
            [booking.vehicle_id]
          )
        }
      }

      // Check if customer has an actual successful payment for this booking
      const [paidRows] = await connection.query(
        `SELECT id, amount, payment_method, transaction_reference 
         FROM payments 
         WHERE booking_id = ? 
           AND customer_id = ? 
           AND payment_status = 'success' 
           AND payment_type != 'refund' 
         ORDER BY id DESC 
         LIMIT 1 
         FOR UPDATE`,
        [bookingId, customerId]
      )

      let refundRecorded = false
      let refundAmount = 0
      let refundStatus = null
      let refundTxnRef = null

      if (paidRows.length > 0) {
        const originalPayment = paidRows[0]
        refundAmount = calculateFullDemoRefund(originalPayment.amount)

        if (refundAmount > 0) {
          // Prevent duplicate refunds for the same booking/payment
          const [existingRefunds] = await connection.query(
            `SELECT id, transaction_reference, payment_status 
             FROM payments 
             WHERE booking_id = ? 
               AND payment_type = 'refund' 
               AND payment_status IN ('initiated', 'refunded') 
             LIMIT 1 
             FOR UPDATE`,
            [bookingId]
          )

          if (existingRefunds.length > 0) {
            throw new Error('A refund has already been initiated or completed for this booking.')
          }

          refundTxnRef = `DEMO-REF-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`
          const validMethods = ['upi', 'net_banking', 'credit_card', 'debit_card', 'cash']
          const refundMethod = validMethods.includes(String(originalPayment.payment_method || '').toLowerCase())
            ? originalPayment.payment_method.toLowerCase()
            : 'upi'
          const linkedGatewayRef = `DEMO_REFUND_PAY_${originalPayment.id}`

          // 1. Create refund record in 'initiated' status
          const [insertResult] = await connection.query(
            `INSERT INTO payments 
             (transaction_reference, booking_id, customer_id, amount, payment_type, payment_method, payment_status, gateway_transaction_id, payment_notes)
             VALUES (?, ?, ?, ?, 'refund', ?, 'initiated', ?, ?)`,
            [
              refundTxnRef,
              bookingId,
              customerId,
              refundAmount,
              refundMethod,
              linkedGatewayRef,
              `DEMO: 100% simulated refund initiated for payment #${originalPayment.id} (no real money transferred)`
            ]
          )

          // 2. Complete the simulated DEMO refund by updating status to 'refunded'
          await connection.query(
            `UPDATE payments 
             SET payment_status = 'refunded', 
                 paid_at = NOW(), 
                 payment_notes = ? 
             WHERE id = ?`,
            [
              `DEMO: 100% simulated refund completed for payment #${originalPayment.id} (no real money transferred)`,
              insertResult.insertId
            ]
          )

          refundRecorded = true
          refundStatus = 'refunded'
        }
      }

      await connection.commit()

      return {
        id: bookingId,
        booking_status: 'cancelled',
        cancellation_reason: normalizedReason,
        refund_initiated: refundRecorded,
        refund_status: refundStatus,
        refund_amount: refundAmount,
        refund_reference: refundTxnRef,
        is_demo_refund: refundRecorded
      }
      } catch (err) {
        await connection.rollback()
        throw err
      } finally {
        connection.release()
      }
    })
  },

  /**
   * Admin / Staff Booking Status Transition & Vehicle Availability Management
   * Enforces valid lifecycle state transitions, concurrency safety with row locks,
   * accurate vehicle availability updates, conflict prevention, and payment preservation.
   *
   * @param {number|string} bookingId - Target booking ID
   * @param {string} targetStatus - Requested status ('pending', 'confirmed', 'active', 'in_progress', 'completed', 'cancelled')
   * @param {Object} options - { staffId, reason }
   * @param {Object} dbPool - Database connection pool (defaults to main pool)
   */
  async updateBookingStatusByAdmin(bookingId, targetStatus, { staffId = null, reason = '' } = {}, dbPool = pool) {
    if (!bookingId || isNaN(Number(bookingId))) {
      const err = new Error('Valid booking ID is required.')
      err.statusCode = 400
      throw err
    }

    const allowedStatuses = ['pending', 'confirmed', 'active', 'in_progress', 'completed', 'cancelled']
    if (!targetStatus || !allowedStatuses.includes(String(targetStatus).trim().toLowerCase())) {
      const err = new Error(`Invalid status. Allowed values: ${allowedStatuses.join(', ')}`)
      err.statusCode = 400
      throw err
    }

    const normalizedTarget = String(targetStatus).trim().toLowerCase() === 'in_progress' ? 'active' : String(targetStatus).trim().toLowerCase()

    return withDeadlockRetry(async () => {
      const connection = await dbPool.getConnection()
      try {
        await connection.beginTransaction()

        // Step 1: Look up vehicle_id first so we can acquire locks in consistent hierarchy:
        // Order: vehicles -> bookings
        const [lookupRows] = await connection.query(
          `SELECT id, vehicle_id FROM bookings WHERE id = ?`,
          [bookingId]
        )

        if (lookupRows.length === 0) {
          const err = new Error('Booking not found.')
          err.statusCode = 404
          throw err
        }

        const vehicleId = lookupRows[0].vehicle_id

        // Step 2: Lock the vehicle row first
        const [vehicleRows] = await connection.query(
          `SELECT id, make, model, registration_number, availability_status, is_active
           FROM vehicles
           WHERE id = ?
           FOR UPDATE`,
          [vehicleId]
        )

        if (vehicleRows.length === 0) {
          const err = new Error('Associated vehicle not found.')
          err.statusCode = 404
          throw err
        }
        const vehicle = vehicleRows[0]

        // Step 3: Lock the target booking row
        const [bookingRows] = await connection.query(
          `SELECT id, booking_reference, customer_id, vehicle_id, start_date, end_date,
                  booking_status, cancellation_reason, approved_by_staff_id, total_amount
           FROM bookings
           WHERE id = ?
           FOR UPDATE`,
          [bookingId]
        )

        if (bookingRows.length === 0) {
          const err = new Error('Booking not found.')
          err.statusCode = 404
          throw err
        }
        const booking = bookingRows[0]
        const currentStatus = booking.booking_status

        // Step 4: Check if already in target status (idempotent no-op)
        if (currentStatus === normalizedTarget) {
          await connection.commit()
          return {
            message: `Booking is already in '${normalizedTarget}' status.`,
            data: {
              id: Number(bookingId),
              status: normalizedTarget,
              previous_status: currentStatus,
              vehicle_id: vehicleId,
              vehicle_availability: vehicle.availability_status,
              no_change: true
            }
          }
        }

        // Step 5: Enforce Terminal State Protections (Requirement B)
        if (currentStatus === 'cancelled') {
          const err = new Error('Cannot update status. Cancelled bookings are terminal and cannot be reopened.')
          err.statusCode = 400
          throw err
        }

        if (currentStatus === 'completed') {
          const err = new Error('Cannot update status. Completed bookings are terminal and cannot be modified.')
          err.statusCode = 400
          throw err
        }

        if (currentStatus === 'rejected') {
          const err = new Error('Cannot update status. Rejected bookings are terminal and cannot be reopened.')
          err.statusCode = 400
          throw err
        }

        // Step 6: Enforce Allowed State Transitions (Requirement A)
        const VALID_TRANSITIONS = {
          pending: ['confirmed', 'cancelled'],
          confirmed: ['active', 'cancelled'],
          active: ['completed'],
          completed: [],
          cancelled: [],
          rejected: []
        }

        const allowedNext = VALID_TRANSITIONS[currentStatus] || []
        if (!allowedNext.includes(normalizedTarget)) {
          let detail = `Transition from '${currentStatus}' to '${normalizedTarget}' is not permitted.`
          if (currentStatus === 'pending' && normalizedTarget === 'active') {
            detail = `Cannot transition booking directly from 'pending' to 'active'. Booking must be confirmed first.`
          } else if (currentStatus === 'pending' && normalizedTarget === 'completed') {
            detail = `Cannot transition booking directly from 'pending' to 'completed'.`
          } else if (currentStatus === 'confirmed' && normalizedTarget === 'pending') {
            detail = `Cannot downgrade confirmed booking to 'pending'.`
          } else if (currentStatus === 'confirmed' && normalizedTarget === 'completed') {
            detail = `Cannot transition booking directly from 'confirmed' to 'completed'. Vehicle must be marked active upon handover first.`
          } else if (currentStatus === 'active' && normalizedTarget === 'cancelled') {
            detail = `Active rentals cannot be cancelled; the rental must be completed upon vehicle return.`
          } else if (currentStatus === 'active' && (normalizedTarget === 'pending' || normalizedTarget === 'confirmed')) {
            detail = `Cannot revert active rental to '${normalizedTarget}'.`
          }
          const err = new Error(detail)
          err.statusCode = 400
          throw err
        }

        // Step 7: Transition-Specific Checks & Execution
        let nextVehicleStatus = vehicle.availability_status

        if (normalizedTarget === 'confirmed') {
          // Transitioning pending -> confirmed
          // Check overlapping confirmed or active bookings on this vehicle for the date range
          const [conflicts] = await connection.query(
            `SELECT id, booking_reference, booking_status, start_date, end_date
             FROM bookings
             WHERE vehicle_id = ?
               AND booking_status IN ('confirmed', 'active')
               AND id != ?
               AND start_date < ?
               AND end_date > ?
             LIMIT 1
             FOR UPDATE`,
            [vehicleId, bookingId, booking.end_date, booking.start_date]
          )

          if (conflicts.length > 0) {
            const err = new Error(`Cannot confirm booking. Vehicle has an overlapping ${conflicts[0].booking_status} booking (${conflicts[0].booking_reference}).`)
            err.statusCode = 409
            throw err
          }

          if (vehicle.availability_status === 'decommissioned') {
            const err = new Error('Cannot confirm booking for a decommissioned vehicle.')
            err.statusCode = 400
            throw err
          }

          // Update booking
          await connection.query(
            `UPDATE bookings
             SET booking_status = 'confirmed',
                 approved_by_staff_id = COALESCE(?, approved_by_staff_id),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [staffId, bookingId]
          )

          // Requirement C: Confirmed booking: booked
          if (vehicle.availability_status === 'available') {
            nextVehicleStatus = 'booked'
            await connection.query(
              `UPDATE vehicles SET availability_status = 'booked', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
              [vehicleId]
            )
          }

        } else if (normalizedTarget === 'active') {
          // Transitioning confirmed -> active (vehicle handover)
          // Check if another rental is already active on this vehicle
          const [activeRentals] = await connection.query(
            `SELECT id, booking_reference
             FROM bookings
             WHERE vehicle_id = ?
               AND booking_status = 'active'
               AND id != ?
             LIMIT 1
             FOR UPDATE`,
            [vehicleId, bookingId]
          )

          if (activeRentals.length > 0) {
            const err = new Error(`Cannot hand over vehicle. Vehicle is already out on an active rental (${activeRentals[0].booking_reference}).`)
            err.statusCode = 409
            throw err
          }

          if (vehicle.availability_status === 'maintenance' || vehicle.availability_status === 'decommissioned') {
            const err = new Error(`Cannot hand over vehicle in '${vehicle.availability_status}' status.`)
            err.statusCode = 400
            throw err
          }

          // Update booking
          await connection.query(
            `UPDATE bookings
             SET booking_status = 'active',
                 approved_by_staff_id = COALESCE(?, approved_by_staff_id),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [staffId, bookingId]
          )

          // Requirement C: Active rental: rented
          nextVehicleStatus = 'rented'
          await connection.query(
            `UPDATE vehicles SET availability_status = 'rented', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [vehicleId]
          )

        } else if (normalizedTarget === 'completed') {
          // Transitioning active -> completed (vehicle return & rental closure)
          await connection.query(
            `UPDATE bookings
             SET booking_status = 'completed',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [bookingId]
          )

          // Requirement C & D: Check remaining confirmed/active bookings on this vehicle
          const [otherBookings] = await connection.query(
            `SELECT id, booking_reference, booking_status, start_date, end_date
             FROM bookings
             WHERE vehicle_id = ?
               AND booking_status IN ('confirmed', 'active')
               AND id != ?
             ORDER BY start_date ASC
             FOR UPDATE`,
            [vehicleId, bookingId]
          )

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

        } else if (normalizedTarget === 'cancelled') {
          // Transitioning pending or confirmed -> cancelled
          const normalizedReason = reason ? reason.trim() : 'Cancelled by administrator'
          await connection.query(
            `UPDATE bookings
             SET booking_status = 'cancelled',
                 cancellation_reason = COALESCE(?, cancellation_reason),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [normalizedReason, bookingId]
          )

          // Requirement C & D: Check remaining confirmed/active bookings on this vehicle
          const [otherBookings] = await connection.query(
            `SELECT id, booking_reference, booking_status, start_date, end_date
             FROM bookings
             WHERE vehicle_id = ?
               AND booking_status IN ('confirmed', 'active')
               AND id != ?
             ORDER BY start_date ASC
             FOR UPDATE`,
            [vehicleId, bookingId]
          )

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
          // Requirement F: Preserve payment and refund constraints. DO NOT touch payments table!
        }

        await connection.commit()

        return {
          message: `Booking status updated to ${normalizedTarget}.`,
          data: {
            id: Number(bookingId),
            status: normalizedTarget,
            previous_status: currentStatus,
            vehicle_id: vehicleId,
            vehicle_availability: nextVehicleStatus
          }
        }
      } catch (err) {
        await connection.rollback()
        throw err
      } finally {
        connection.release()
      }
    })
  }
}

export default bookingService
