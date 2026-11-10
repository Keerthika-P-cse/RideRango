import { Router } from 'express'
import { login, register, getMe } from '../controllers/authController.js'
import { requireCustomerAuth } from '../middleware/authMiddleware.js'
import { customerLoginLimiter } from '../middleware/rateLimiter.js'

const router = Router()

// Public authentication routes
router.post('/login', customerLoginLimiter, login)
router.post('/register', register)

// Protected customer profile
router.get('/me', requireCustomerAuth, getMe)

export default router
