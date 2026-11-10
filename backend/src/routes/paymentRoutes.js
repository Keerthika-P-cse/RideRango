import { Router } from 'express'
import { createOrder, verifyPayment, recordFailure } from '../controllers/paymentController.js'
import { requireCustomerAuth } from '../middleware/authMiddleware.js'

const router = Router()

// Protected payment processing endpoints
router.post('/payments/create-order', requireCustomerAuth, createOrder)
router.post('/payments/verify', requireCustomerAuth, verifyPayment)
router.post('/payments/failure', requireCustomerAuth, recordFailure)

export default router
