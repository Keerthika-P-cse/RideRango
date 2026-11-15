import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import pool from '../config/db.js'
import { sendError } from '../utils/apiResponse.js'
import { requireStaffAuth } from '../middleware/authMiddleware.js'
import {
  recordVehicleHandover,
  getHandoverByBooking,
  getAdminHandoversList
} from '../controllers/handoverController.js'

const router = Router()

/**
 * Flexible middleware: accepts either customer OR staff authentication.
 * Populates req.customer or req.staff accordingly.
 */
const requireCustomerOrStaffAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Authentication required to access vehicle handover details.', 401)
    }

    const token = authHeader.split(' ')[1]
    if (!token) {
      return sendError(res, 'Authentication token missing.', 401)
    }

    let decoded
    try {
      decoded = jwt.verify(token, env.JWT_SECRET)
    } catch {
      return sendError(res, 'Invalid authentication token.', 401)
    }

    if (!decoded || !decoded.id) {
      return sendError(res, 'Invalid token payload.', 401)
    }

    if (decoded.type === 'staff') {
      const [rows] = await pool.query(
        'SELECT id, first_name, last_name, email, role, is_active FROM staff WHERE id = ?',
        [decoded.id]
      )
      if (rows.length === 0 || !rows[0].is_active) {
        return sendError(res, 'Staff account not found or deactivated.', 403)
      }
      req.staff = rows[0]
      return next()
    } else {
      const [rows] = await pool.query(
        'SELECT id, first_name, last_name, email, is_active FROM customers WHERE id = ?',
        [decoded.id]
      )
      if (rows.length === 0 || !rows[0].is_active) {
        return sendError(res, 'Customer account not found or suspended.', 403)
      }
      req.customer = rows[0]
      return next()
    }
  } catch (err) {
    console.error('requireCustomerOrStaffAuth error for handovers:', err)
    return sendError(res, 'Authentication check failed.', 500)
  }
}

// Staff: Record vehicle handover
router.post('/', requireStaffAuth, recordVehicleHandover)
router.post('/record', requireStaffAuth, recordVehicleHandover)

// Staff: List handovers
router.get('/admin/list', requireStaffAuth, getAdminHandoversList)

// Customer (own booking) or Staff: Get handover for booking
router.get('/booking/:bookingId', requireCustomerOrStaffAuth, getHandoverByBooking)

export default router
