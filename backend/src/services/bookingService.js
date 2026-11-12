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
  async getBookingById(bookingId, customerId) {
    const [rows] = await pool.query(
      `SELECT b.*, 
              v.make, v.model, v.registration_number, v.color, v.fuel_type, v.transmission, 
              v.seating_capacity, v.features_json,
              vc.name as category_name, vc.slug as category_slug,
              c.first_name, c.last_name, c.email, c.phone, c.driving_license_number,
              p.transaction_reference, p.payment_status, p.payment_method, p.paid_at, p.amount as paid_amount,
              r.transaction_reference as refund_reference, r.payment_status as refund_status,
              r.amount as refund_amount, r.paid_at as refunded_at, r.payment_notes as refund_notes
       FROM bookings b
       JOIN vehicles v ON b.vehicle_id = v.id
       JOIN vehicle_categories vc ON v.category_id = vc.id
       JOIN customers c ON b.customer_id = c.id
       LEFT JOIN payments p ON p.id = (
         SELECT p2.id FROM payments p2
         WHERE p2.booking_id = b.id AND p2.payment_status = 'success' AND p2.payment_type != 'refund'
         ORDER BY p2.id DESC LIMIT 1
       )
       LEFT JOIN payments r ON r.id = (
         SELECT r2.id FROM payments r2
         WHERE r2.booking_id = b.id AND r2.payment_type = 'refund'
         ORDER BY r2.id DESC LIMIT 1
       )
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
  async getCustomerBookings(customerId) {
    const [rows] = await pool.query(
      `SELECT b.*, 
              v.make, v.model, v.registration_number, v.fuel_type, v.transmission,
              vc.name as category_name, vc.slug as category_slug,
              p.transaction_reference, p.payment_status, p.payment_method, p.paid_at, p.amount as paid_amount,
              r.transaction_reference as refund_reference, r.payment_status as refund_status,
              r.amount as refund_amount, r.paid_at as refunded_at, r.payment_notes as refund_notes
       FROM bookings b
       JOIN vehicles v ON b.vehicle_id = v.id
       JOIN vehicle_categories vc ON v.category_id = vc.id
       LEFT JOIN payments p ON p.id = (
         SELECT p2.id FROM payments p2
         WHERE p2.booking_id = b.id AND p2.payment_status = 'success' AND p2.payment_type != 'refund'
         ORDER BY p2.id DESC LIMIT 1
       )
       LEFT JOIN payments r ON r.id = (
         SELECT r2.id FROM payments r2
         WHERE r2.booking_id = b.id AND r2.payment_type = 'refund'
         ORDER BY r2.id DESC LIMIT 1
       )
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
  }
}

export default bookingService
