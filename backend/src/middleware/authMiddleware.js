import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import pool from '../config/db.js'
import { sendError } from '../utils/apiResponse.js'

/**
 * Require valid customer authentication
 * Enforces customer security on the backend.
 */
export const requireCustomerAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Authentication required. Please log in to continue.', 401)
    }

    const token = authHeader.split(' ')[1]
    if (!token) {
      return sendError(res, 'Authentication token missing.', 401)
    }

    let decoded
    try {
      decoded = jwt.verify(token, env.JWT_SECRET)
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return sendError(res, 'Session expired. Please log in again.', 401)
      }
      return sendError(res, 'Invalid authentication token.', 401)
    }

    if (!decoded || !decoded.id) {
      return sendError(res, 'Invalid token payload.', 401)
    }

    // Verify customer exists and is active in database
    const [rows] = await pool.query(
      `SELECT id, first_name, last_name, email, phone, address_line1, city, state, pincode, 
              driving_license_number, verification_status, is_active 
       FROM customers 
       WHERE id = ?`,
      [decoded.id]
    )

    if (rows.length === 0 || !rows[0].is_active) {
      return sendError(res, 'Customer account not found or suspended.', 403)
    }

    req.customer = rows[0]
    next()
  } catch (error) {
    console.error('requireCustomerAuth error:', error.message)
    return sendError(res, 'Authentication check failed.', 500)
  }
}

/**
 * Require valid staff/admin authentication
 */
export const requireStaffAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Staff authentication required.', 401)
    }

    const token = authHeader.split(' ')[1]
    if (!token) {
      return sendError(res, 'Authentication token missing.', 401)
    }

    let decoded
    try {
      decoded = jwt.verify(token, env.JWT_SECRET)
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return sendError(res, 'Staff session expired. Please log in again.', 401)
      }
      return sendError(res, 'Invalid authentication token.', 401)
    }

    if (!decoded || !decoded.id || decoded.type !== 'staff') {
      return sendError(res, 'Invalid staff credentials token.', 401)
    }

    const [rows] = await pool.query(
      `SELECT id, first_name, last_name, email, phone, role, is_active 
       FROM staff 
       WHERE id = ?`,
      [decoded.id]
    )

    if (rows.length === 0 || !rows[0].is_active) {
      return sendError(res, 'Staff account not found or deactivated.', 403)
    }

    req.staff = rows[0]
    next()
  } catch (error) {
    console.error('requireStaffAuth error:', error.message)
    return sendError(res, 'Staff authentication check failed.', 500)
  }
}

/**
 * Require Admin role strictly
 */
export const requireAdmin = (req, res, next) => {
  if (!req.staff || req.staff.role !== 'admin') {
    return sendError(res, 'Access denied. Administrator privileges required.', 403)
  }
  next()
}
