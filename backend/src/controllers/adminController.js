import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import pool from '../config/db.js'
import { env } from '../config/env.js'
import { sendSuccess, sendError } from '../utils/apiResponse.js'
import { enrichVehicleData } from '../services/vehicleService.js'

/**
 * 1. Staff / Admin Login
 */
export const loginStaff = async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return sendError(res, 'Email and password are required.', 400)
    }

    const [rows] = await pool.query(
      `SELECT id, first_name, last_name, email, phone, password_hash, role, approval_status, is_active 
       FROM staff 
       WHERE email = ?`,
      [email.trim().toLowerCase()]
    )

    if (rows.length === 0) {
      return sendError(res, 'Invalid credentials.', 401)
    }

    const staffMember = rows[0]

    // Check approval status first
    if (staffMember.approval_status === 'pending') {
      return sendError(res, 'Your staff registration is pending Administrator approval. You will receive access once approved.', 403)
    }
    if (staffMember.approval_status === 'rejected') {
      return sendError(res, 'Your staff application was not approved. Please contact an administrator.', 403)
    }

    if (!staffMember.is_active) {
      return sendError(res, 'This staff account has been deactivated. Please contact an administrator.', 403)
    }

    const isMatch = await bcrypt.compare(password, staffMember.password_hash)
    if (!isMatch) {
      return sendError(res, 'Invalid credentials.', 401)
    }

    const token = jwt.sign(
      {
        id: staffMember.id,
        email: staffMember.email,
        role: staffMember.role,
        type: 'staff'
      },
      env.JWT_SECRET,
      { expiresIn: '12h' }
    )

    return sendSuccess(res, 'Authentication successful.', {
      token,
      user: {
        id: staffMember.id,
        first_name: staffMember.first_name,
        last_name: staffMember.last_name,
        email: staffMember.email,
        phone: staffMember.phone,
        role: staffMember.role
      }
    })
  } catch (err) {
    console.error('Staff login error:', err)
    return sendError(res, 'Authentication service error.', 500)
  }
}

/**
 * 2. Get Staff Profile (Me)
 */
export const getStaffProfile = async (req, res) => {
  return sendSuccess(res, 'Staff profile retrieved.', { user: req.staff })
}

/**
 * 3. Dashboard Homepage Stats
 */
export const getDashboardStats = async (req, res) => {
  try {
    const [vehiclesSummary] = await pool.query(`
      SELECT 
        COUNT(*) as total_vehicles,
        SUM(CASE 
          WHEN v.is_active = 1 
           AND v.availability_status = 'available'
           AND v.id NOT IN (
             SELECT vehicle_id FROM bookings WHERE booking_status IN ('confirmed', 'active')
           )
          THEN 1 ELSE 0 
        END) as available_vehicles,
        SUM(CASE 
          WHEN v.availability_status IN ('booked', 'rented')
            OR v.id IN (
              SELECT vehicle_id FROM bookings WHERE booking_status IN ('confirmed', 'active')
            )
          THEN 1 ELSE 0 
        END) as booked_vehicles
      FROM vehicles v
    `)

    const [customersSummary] = await pool.query(`
      SELECT COUNT(*) as total_customers FROM customers WHERE is_active = 1
    `)

    const [bookingsSummary] = await pool.query(`
      SELECT 
        COUNT(*) as total_bookings,
        SUM(CASE WHEN booking_status = 'pending' THEN 1 ELSE 0 END) as pending_bookings,
        SUM(CASE WHEN booking_status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_bookings,
        SUM(CASE WHEN booking_status = 'completed' THEN 1 ELSE 0 END) as completed_bookings,
        SUM(CASE WHEN booking_status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_bookings
      FROM bookings
    `)

    const [paymentsSummary] = await pool.query(`
      SELECT 
        SUM(CASE WHEN payment_status = 'success' THEN 1 ELSE 0 END) as total_successful_payments,
        SUM(CASE WHEN payment_status = 'initiated' THEN 1 ELSE 0 END) as pending_payments,
        COALESCE(SUM(CASE WHEN payment_status = 'success' THEN amount ELSE 0 END), 0) as total_revenue
      FROM payments
    `)

    // Recent 5 bookings
    const [recentBookings] = await pool.query(`
      SELECT b.id, b.booking_reference, b.booking_status, b.start_date, b.end_date, b.total_amount,
             c.first_name as customer_first_name, c.last_name as customer_last_name, c.email as customer_email,
             v.make, v.model, v.registration_number
      FROM bookings b
      LEFT JOIN customers c ON b.customer_id = c.id
      LEFT JOIN vehicles v ON b.vehicle_id = v.id
      ORDER BY b.created_at DESC
      LIMIT 5
    `)

    return sendSuccess(res, 'Dashboard stats retrieved successfully.', {
      totalVehicles: parseInt(vehiclesSummary[0].total_vehicles || 0, 10),
      availableVehicles: parseInt(vehiclesSummary[0].available_vehicles || 0, 10),
      bookedVehicles: parseInt(vehiclesSummary[0].booked_vehicles || 0, 10),
      totalCustomers: parseInt(customersSummary[0].total_customers || 0, 10),
      totalBookings: parseInt(bookingsSummary[0].total_bookings || 0, 10),
      pendingBookings: parseInt(bookingsSummary[0].pending_bookings || 0, 10),
      confirmedBookings: parseInt(bookingsSummary[0].confirmed_bookings || 0, 10),
      completedBookings: parseInt(bookingsSummary[0].completed_bookings || 0, 10),
      cancelledBookings: parseInt(bookingsSummary[0].cancelled_bookings || 0, 10),
      totalSuccessfulPayments: parseInt(paymentsSummary[0].total_successful_payments || 0, 10),
      pendingPayments: parseInt(paymentsSummary[0].pending_payments || 0, 10),
      totalRevenue: parseFloat(paymentsSummary[0].total_revenue || 0),
      recentBookings
    })
  } catch (err) {
    console.error('getDashboardStats error:', err)
    return sendError(res, 'Failed to calculate dashboard statistics.', 500)
  }
}

/**
 * 4. Vehicle Categories
 */
export const getVehicleCategories = async (req, res) => {
  try {
    const [categories] = await pool.query('SELECT id, name, slug, description FROM vehicle_categories ORDER BY id ASC')
    return sendSuccess(res, 'Categories retrieved.', categories)
  } catch (err) {
    console.error('getVehicleCategories error:', err)
    return sendError(res, 'Failed to fetch categories.', 500)
  }
}

/**
 * 5. Vehicle Management: List Vehicles
 */
export const getAdminVehicles = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT v.*, vc.name as category_name, vc.slug as category_slug,
             (SELECT COUNT(*) FROM bookings b WHERE b.vehicle_id = v.id) as total_bookings_count
      FROM vehicles v
      LEFT JOIN vehicle_categories vc ON v.category_id = vc.id
      ORDER BY v.id ASC
    `)

    const enriched = rows.map(v => enrichVehicleData(v))
    return sendSuccess(res, 'Vehicles retrieved.', enriched)
  } catch (err) {
    console.error('getAdminVehicles error:', err)
    return sendError(res, err.message || 'Failed to retrieve vehicles.', 500)
  }
}

/**
 * 6. Vehicle Management: Add Vehicle (Admin Only)
 */
export const createAdminVehicle = async (req, res) => {
  try {
    const {
      category_id,
      registration_number,
      make,
      model,
      year,
      color,
      fuel_type,
      transmission,
      seating_capacity,
      daily_rate,
      hourly_rate,
      security_deposit,
      availability_status = 'available',
      location = 'Main Hub',
      is_active = 1
    } = req.body

    if (!category_id || !registration_number || !make || !model || !year || !fuel_type || !transmission || !daily_rate) {
      return sendError(res, 'Please provide all required vehicle fields.', 400)
    }

    const [existing] = await pool.query('SELECT id FROM vehicles WHERE registration_number = ?', [registration_number.trim()])
    if (existing.length > 0) {
      return sendError(res, 'A vehicle with this registration number already exists.', 400)
    }

    const [result] = await pool.query(
      `INSERT INTO vehicles 
        (category_id, registration_number, make, model, year, color, fuel_type, transmission, 
         seating_capacity, daily_rate, hourly_rate, security_deposit, availability_status, location, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        parseInt(category_id, 10),
        registration_number.trim(),
        make.trim(),
        model.trim(),
        parseInt(year, 10),
        color ? color.trim() : null,
        fuel_type,
        transmission,
        parseInt(seating_capacity || 2, 10),
        parseFloat(daily_rate),
        hourly_rate ? parseFloat(hourly_rate) : null,
        security_deposit ? parseFloat(security_deposit) : 2000.00,
        availability_status,
        location,
        is_active ? 1 : 0
      ]
    )

    return sendSuccess(res, 'Vehicle created successfully.', { id: result.insertId }, 201)
  } catch (err) {
    console.error('createAdminVehicle error:', err)
    return sendError(res, err.message || 'Failed to create vehicle.', 500)
  }
}

/**
 * 7. Vehicle Management: Edit Vehicle (Admin Only)
 */
export const updateAdminVehicle = async (req, res) => {
  try {
    const { id } = req.params
    const {
      category_id,
      registration_number,
      make,
      model,
      year,
      color,
      fuel_type,
      transmission,
      seating_capacity,
      daily_rate,
      hourly_rate,
      security_deposit,
      availability_status,
      location,
      is_active
    } = req.body

    const [existing] = await pool.query('SELECT id FROM vehicles WHERE id = ?', [id])
    if (existing.length === 0) {
      return sendError(res, 'Vehicle not found.', 404)
    }

    if (registration_number) {
      const [dup] = await pool.query('SELECT id FROM vehicles WHERE registration_number = ? AND id != ?', [registration_number.trim(), id])
      if (dup.length > 0) {
        return sendError(res, 'Another vehicle already has this registration number.', 400)
      }
    }

    await pool.query(
      `UPDATE vehicles SET
        category_id = COALESCE(?, category_id),
        registration_number = COALESCE(?, registration_number),
        make = COALESCE(?, make),
        model = COALESCE(?, model),
        year = COALESCE(?, year),
        color = COALESCE(?, color),
        fuel_type = COALESCE(?, fuel_type),
        transmission = COALESCE(?, transmission),
        seating_capacity = COALESCE(?, seating_capacity),
        daily_rate = COALESCE(?, daily_rate),
        hourly_rate = COALESCE(?, hourly_rate),
        security_deposit = COALESCE(?, security_deposit),
        availability_status = COALESCE(?, availability_status),
        location = COALESCE(?, location),
        is_active = COALESCE(?, is_active),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        category_id ? parseInt(category_id, 10) : null,
        registration_number ? registration_number.trim() : null,
        make ? make.trim() : null,
        model ? model.trim() : null,
        year ? parseInt(year, 10) : null,
        color !== undefined ? color : null,
        fuel_type || null,
        transmission || null,
        seating_capacity ? parseInt(seating_capacity, 10) : null,
        daily_rate ? parseFloat(daily_rate) : null,
        hourly_rate !== undefined ? (hourly_rate ? parseFloat(hourly_rate) : null) : null,
        security_deposit ? parseFloat(security_deposit) : null,
        availability_status || null,
        location || null,
        is_active !== undefined ? (is_active ? 1 : 0) : null,
        id
      ]
    )

    return sendSuccess(res, 'Vehicle updated successfully.', { id })
  } catch (err) {
    console.error('updateAdminVehicle error:', err)
    return sendError(res, err.message || 'Failed to update vehicle.', 500)
  }
}

/**
 * 8. Booking Management: List Bookings
 */
export const getAdminBookings = async (req, res) => {
  try {
    const { status, search } = req.query
    let sql = `
      SELECT b.*,
             c.first_name as customer_first_name, c.last_name as customer_last_name, 
             c.email as customer_email, c.phone as customer_phone,
             v.make, v.model, v.registration_number, v.year as vehicle_year,
             vc.name as category_name, vc.slug as category_slug,
             p.payment_status, p.gateway_transaction_id, p.transaction_reference, p.payment_method
      FROM bookings b
      LEFT JOIN customers c ON b.customer_id = c.id
      LEFT JOIN vehicles v ON b.vehicle_id = v.id
      LEFT JOIN vehicle_categories vc ON v.category_id = vc.id
      LEFT JOIN (
        SELECT p1.booking_id, p1.amount, p1.payment_status, p1.gateway_transaction_id, p1.transaction_reference, p1.payment_method
        FROM payments p1
        INNER JOIN (
          SELECT booking_id, MAX(id) as max_id
          FROM payments
          GROUP BY booking_id
        ) p2 ON p1.id = p2.max_id
      ) p ON b.id = p.booking_id
      WHERE 1=1
    `
    const params = []

    if (status && status !== 'all') {
      sql += ` AND b.booking_status = ?`
      params.push(status)
    }

    if (search && search.trim() !== '') {
      sql += ` AND (b.booking_reference LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR c.email LIKE ? OR v.model LIKE ?)`
      const term = `%${search.trim()}%`
      params.push(term, term, term, term, term)
    }

    sql += ` ORDER BY b.created_at DESC`

    const [rows] = await pool.query(sql, params)
    const enriched = rows.map(b => enrichVehicleData(b))

    return sendSuccess(res, 'Bookings retrieved.', enriched)
  } catch (err) {
    console.error('getAdminBookings error:', err)
    return sendError(res, 'Failed to retrieve bookings.', 500)
  }
}

/**
 * 9. Booking Management: Update Booking Status
 */
export const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body

    const allowed = ['pending', 'confirmed', 'active', 'in_progress', 'completed', 'cancelled']
    if (!allowed.includes(status)) {
      return sendError(res, `Invalid status. Allowed values: ${allowed.join(', ')}`, 400)
    }

    // Map 'in_progress' to DB enum 'active'
    const dbStatus = status === 'in_progress' ? 'active' : status

    const [booking] = await pool.query('SELECT id, vehicle_id, booking_status FROM bookings WHERE id = ?', [id])
    if (booking.length === 0) {
      return sendError(res, 'Booking not found.', 404)
    }

    await pool.query(
      `UPDATE bookings SET booking_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [dbStatus, id]
    )

    if (dbStatus === 'completed' || dbStatus === 'cancelled') {
      await pool.query(
        `UPDATE vehicles SET availability_status = 'available' WHERE id = ?`,
        [booking[0].vehicle_id]
      )
    } else if (dbStatus === 'confirmed' || dbStatus === 'active') {
      await pool.query(
        `UPDATE vehicles SET availability_status = 'booked' WHERE id = ?`,
        [booking[0].vehicle_id]
      )
    }

    return sendSuccess(res, `Booking status updated to ${dbStatus}.`, { id, status: dbStatus })
  } catch (err) {
    console.error('updateBookingStatus error:', err)
    return sendError(res, 'Failed to update booking status.', 500)
  }
}

/**
 * 10. Customer Management: List Customers
 */
export const getAdminCustomers = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.id, c.first_name, c.last_name, c.email, c.phone, c.created_at, c.is_active,
             COUNT(b.id) as total_bookings,
             COALESCE(SUM(CASE WHEN b.booking_status IN ('confirmed', 'completed') THEN b.total_amount ELSE 0 END), 0) as total_spent
      FROM customers c
      LEFT JOIN bookings b ON c.id = b.customer_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `)

    return sendSuccess(res, 'Customers retrieved.', rows)
  } catch (err) {
    console.error('getAdminCustomers error:', err)
    return sendError(res, 'Failed to retrieve customers.', 500)
  }
}

/**
 * 11. Customer Management: Customer Booking History
 */
export const getCustomerBookingsHistory = async (req, res) => {
  try {
    const { id } = req.params
    const [customer] = await pool.query(
      `SELECT id, first_name, last_name, email, phone, created_at, driving_license_number, city 
       FROM customers WHERE id = ?`,
      [id]
    )

    if (customer.length === 0) {
      return sendError(res, 'Customer not found.', 404)
    }

    const [bookings] = await pool.query(`
      SELECT b.*, v.make, v.model, v.registration_number, vc.name as category_name,
             p.payment_status, p.amount as payment_amount
      FROM bookings b
      LEFT JOIN vehicles v ON b.vehicle_id = v.id
      LEFT JOIN vehicle_categories vc ON v.category_id = vc.id
      LEFT JOIN (
        SELECT p1.booking_id, p1.amount, p1.payment_status, p1.gateway_transaction_id, p1.transaction_reference, p1.payment_method
        FROM payments p1
        INNER JOIN (
          SELECT booking_id, MAX(id) as max_id
          FROM payments
          GROUP BY booking_id
        ) p2 ON p1.id = p2.max_id
      ) p ON b.id = p.booking_id
      WHERE b.customer_id = ?
      ORDER BY b.created_at DESC
    `, [id])

    return sendSuccess(res, 'Customer booking history retrieved.', {
      customer: customer[0],
      bookings: bookings.map(b => enrichVehicleData(b))
    })
  } catch (err) {
    console.error('getCustomerBookingsHistory error:', err)
    return sendError(res, 'Failed to retrieve customer history.', 500)
  }
}

/**
 * 12. Payment Management: List Payments
 */
export const getAdminPayments = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.*,
             b.booking_reference, b.booking_status,
             c.first_name as customer_first_name, c.last_name as customer_last_name, c.email as customer_email,
             v.make, v.model
      FROM payments p
      LEFT JOIN bookings b ON p.booking_id = b.id
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN vehicles v ON b.vehicle_id = v.id
      ORDER BY p.created_at DESC
    `)

    return sendSuccess(res, 'Payments retrieved.', rows)
  } catch (err) {
    console.error('getAdminPayments error:', err)
    return sendError(res, 'Failed to retrieve payments.', 500)
  }
}

/**
 * 13. Staff Management: List Staff (Admin Only)
 */
export const getAdminStaffList = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, first_name, last_name, email, phone, role, approval_status, is_active, created_at 
      FROM staff 
      ORDER BY id ASC
    `)

    return sendSuccess(res, 'Staff list retrieved.', rows)
  } catch (err) {
    console.error('getAdminStaffList error:', err)
    return sendError(res, 'Failed to retrieve staff list.', 500)
  }
}

/**
 * 14. Staff Management: Create Staff (Admin Only)
 */
export const createAdminStaff = async (req, res) => {
  try {
    const { first_name, last_name, email, phone, password, role = 'fleet_staff' } = req.body

    if (!first_name || !last_name || !email || !password) {
      return sendError(res, 'First name, last name, email and password are required.', 400)
    }

    const [existing] = await pool.query('SELECT id FROM staff WHERE email = ?', [email.trim().toLowerCase()])
    if (existing.length > 0) {
      return sendError(res, 'A staff member with this email already exists.', 400)
    }

    const password_hash = await bcrypt.hash(password, 10)

    const [result] = await pool.query(
      `INSERT INTO staff (first_name, last_name, email, phone, password_hash, role, approval_status, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 'approved', 1)`,
      [first_name.trim(), last_name.trim(), email.trim().toLowerCase(), phone ? phone.trim() : null, password_hash, role]
    )

    return sendSuccess(res, 'Staff member created successfully.', { id: result.insertId }, 201)
  } catch (err) {
    console.error('createAdminStaff error:', err)
    return sendError(res, 'Failed to create staff member.', 500)
  }
}

/**
 * 15. Staff Management: Toggle Staff Status (Admin Only)
 */
export const toggleStaffStatus = async (req, res) => {
  try {
    const { id } = req.params
    const { is_active } = req.body

    if (parseInt(id, 10) === req.staff.id) {
      return sendError(res, 'You cannot deactivate your own account.', 400)
    }

    await pool.query('UPDATE staff SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, id])
    return sendSuccess(res, 'Staff status updated.', { id, is_active: is_active ? 1 : 0 })
  } catch (err) {
    console.error('toggleStaffStatus error:', err)
    return sendError(res, 'Failed to update staff status.', 500)
  }
}

/**
 * 16. Public Staff Self-Registration
 * Automatically sets role = 'fleet_staff', approval_status = 'pending', is_active = 0
 */
export const registerStaff = async (req, res) => {
  try {
    const { first_name, last_name, email, phone, password } = req.body

    if (!first_name || !last_name || !email || !password) {
      return sendError(res, 'First name, last name, email and password are required.', 400)
    }

    if (password.length < 6) {
      return sendError(res, 'Password must be at least 6 characters.', 400)
    }

    const cleanEmail = email.trim().toLowerCase()
    const cleanPhone = phone ? phone.trim() : null

    // Check duplicate email
    const [existingEmail] = await pool.query('SELECT id FROM staff WHERE email = ?', [cleanEmail])
    if (existingEmail.length > 0) {
      return sendError(res, 'A staff account with this email address already exists.', 400)
    }

    // Check duplicate phone if provided
    if (cleanPhone) {
      const [existingPhone] = await pool.query('SELECT id FROM staff WHERE phone = ?', [cleanPhone])
      if (existingPhone.length > 0) {
        return sendError(res, 'A staff account with this phone number already exists.', 400)
      }
    }

    const password_hash = await bcrypt.hash(password, 10)

    // Strictly fleet_staff, pending approval, inactive until admin approves
    const [result] = await pool.query(
      `INSERT INTO staff (first_name, last_name, email, phone, password_hash, role, approval_status, is_active)
       VALUES (?, ?, ?, ?, ?, 'fleet_staff', 'pending', 0)`,
      [first_name.trim(), last_name.trim(), cleanEmail, cleanPhone, password_hash]
    )

    return sendSuccess(
      res,
      'Staff registration submitted successfully. Your account is pending Administrator approval before you can access the Staff Portal.',
      { id: result.insertId },
      201
    )
  } catch (err) {
    console.error('registerStaff error:', err)
    return sendError(res, 'Failed to submit staff registration.', 500)
  }
}

/**
 * 17. Staff Management: Update Approval Status (Admin Only)
 */
export const updateStaffApproval = async (req, res) => {
  try {
    const { id } = req.params
    const { approval_status } = req.body

    if (!['approved', 'rejected', 'pending'].includes(approval_status)) {
      return sendError(res, 'Invalid approval status. Must be approved, rejected, or pending.', 400)
    }

    if (parseInt(id, 10) === req.staff.id) {
      return sendError(res, 'You cannot modify your own administrative approval status.', 400)
    }

    const isActive = approval_status === 'approved' ? 1 : 0

    await pool.query(
      'UPDATE staff SET approval_status = ?, is_active = ? WHERE id = ?',
      [approval_status, isActive, id]
    )

    return sendSuccess(res, `Staff application has been ${approval_status}.`, {
      id: parseInt(id, 10),
      approval_status,
      is_active: isActive
    })
  } catch (err) {
    console.error('updateStaffApproval error:', err)
    return sendError(res, 'Failed to update staff approval status.', 500)
  }
}
