import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import pool from '../config/db.js'
import { sendError } from '../utils/apiResponse.js'
import { requireCustomerAuth, requireStaffAuth } from '../middleware/authMiddleware.js'
import {
  generateAgreement,
  getAgreementByBooking,
  acceptAgreement,
  getAdminAgreementsList
} from '../controllers/agreementController.js'

const router = Router()

/**
 * Flexible middleware: accepts either customer OR staff authentication.
 * Populates req.customer or req.staff accordingly.
 */
const requireCustomerOrStaffAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Authentication required to access rental agreements.', 401)
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
      const [rows] = await pool.query('SELECT id, first_name, last_name, email, role, is_active FROM staff WHERE id = ?', [decoded.id])
      if (rows.length === 0 || !rows[0].is_active) {
        return sendError(res, 'Staff account not found or deactivated.', 403)
      }
      req.staff = rows[0]
      return next()
    } else {
      const [rows] = await pool.query('SELECT id, first_name, last_name, email, is_active FROM customers WHERE id = ?', [decoded.id])
      if (rows.length === 0 || !rows[0].is_active) {
        return sendError(res, 'Customer account not found or suspended.', 403)
      }
      req.customer = rows[0]
      return next()
    }
  } catch (err) {
    console.error('requireCustomerOrStaffAuth error:', err)
    return sendError(res, 'Authentication check failed.', 500)
  }
}

// 1. Staff: Generate sample agreement for a confirmed booking
router.post('/generate', requireStaffAuth, generateAgreement)

// 2. Staff: List all rental agreements
router.get('/admin/list', requireStaffAuth, getAdminAgreementsList)

// 3. Customer or Staff: Retrieve agreement by booking ID or reference
router.get('/booking/:bookingId', requireCustomerOrStaffAuth, getAgreementByBooking)

// 4. Customer: Accept agreement by agreement ID
router.post('/:id/accept', requireCustomerAuth, acceptAgreement)

export default router
