import pool from '../config/db.js'
import { enrichVehicleData } from './vehicleService.js'

/**
 * Helper to generate unique booking reference: RR-BK-XXXXXX
 */
const generateBookingReference = () => {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.floor(1000 + Math.random() * 9000)
  return `RR-BK-${timestamp}-${random}`
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
    if (vehicle.availability_status === 'decommissioned' || vehicle.availability_status === 'maintenance') {
      return {
        available: false,
        reason: `Vehicle is currently in ${vehicle.availability_status} status.`,
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

      if (vehicle.availability_status === 'decommissioned' || vehicle.availability_status === 'maintenance') {
        throw new Error(`This vehicle is currently unavailable (${vehicle.availability_status}).`)
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
              p.transaction_reference, p.payment_status, p.payment_method, p.paid_at, p.gateway_transaction_id
       FROM bookings b
       JOIN vehicles v ON b.vehicle_id = v.id
       JOIN vehicle_categories vc ON v.category_id = vc.id
       JOIN customers c ON b.customer_id = c.id
       LEFT JOIN payments p ON b.id = p.booking_id AND p.payment_status = 'success'
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
              p.transaction_reference, p.payment_status, p.payment_method, p.paid_at, p.gateway_transaction_id
       FROM bookings b
       JOIN vehicles v ON b.vehicle_id = v.id
       JOIN vehicle_categories vc ON v.category_id = vc.id
       LEFT JOIN payments p ON b.id = p.booking_id AND p.payment_status = 'success'
       WHERE b.customer_id = ?
       ORDER BY b.created_at DESC`,
      [customerId]
    )

    return rows.map((r) => enrichVehicleData(r))
  },

  /**
   * Cancel customer booking according to business rules
   */
  async cancelBooking(bookingId, customerId, reason = '') {
    const connection = await pool.getConnection()

    try {
      await connection.beginTransaction()

      const [rows] = await connection.query(
        `SELECT b.*, p.id as payment_id, p.payment_status, p.amount as paid_amount 
         FROM bookings b
         LEFT JOIN payments p ON b.id = p.booking_id AND p.payment_status = 'success'
         WHERE b.id = ? AND b.customer_id = ? 
         FOR UPDATE`,
        [bookingId, customerId]
      )

      if (rows.length === 0) {
        throw new Error('Booking not found or not owned by you.')
      }

      const booking = rows[0]

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

      // Update booking status to cancelled
      await connection.query(
        `UPDATE bookings 
         SET booking_status = 'cancelled', 
             cancellation_reason = ? 
         WHERE id = ?`,
        [reason ? reason.trim() : 'Customer requested cancellation', bookingId]
      )

      // Restore vehicle availability if no other active/confirmed bookings exist for this vehicle
      await connection.query(
        `UPDATE vehicles 
         SET availability_status = 'available' 
         WHERE id = ? 
           AND id NOT IN (
             SELECT vehicle_id FROM bookings WHERE booking_status IN ('confirmed', 'active') AND id != ?
           )`,
        [booking.vehicle_id, bookingId]
      )

      // If customer has made a payment, record refund initiation
      let refundRecorded = false
      if (booking.payment_status === 'success') {
        const refundTxnRef = `REF-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`
        await connection.query(
          `INSERT INTO payments 
           (transaction_reference, booking_id, customer_id, amount, payment_type, payment_method, payment_status, payment_notes)
           VALUES (?, ?, ?, ?, 'refund', 'upi', 'initiated', 'Automatic cancellation refund request initiated')`,
          [refundTxnRef, bookingId, customerId, booking.paid_amount || booking.total_amount]
        )
        refundRecorded = true
      }

      await connection.commit()

      return {
        id: bookingId,
        booking_status: 'cancelled',
        cancellation_reason: reason || 'Customer requested cancellation',
        refund_initiated: refundRecorded
      }
    } catch (err) {
      await connection.rollback()
      throw err
    } finally {
      connection.release()
    }
  }
}

export default bookingService
