import { Router } from 'express'
import {
  checkAvailability,
  getBookedDates,
  createBooking,
  getMyBookings,
  getBookingById,
  cancelBooking
} from '../controllers/bookingController.js'
import { requireCustomerAuth } from '../middleware/authMiddleware.js'

const router = Router()

// Public availability check & booked date ranges
router.get('/vehicles/:vehicleId/availability', checkAvailability)
router.get('/vehicles/:vehicleId/booked-dates', getBookedDates)

// Protected customer booking endpoints
router.post('/bookings', requireCustomerAuth, createBooking)
router.get('/bookings/my-bookings', requireCustomerAuth, getMyBookings)
router.get('/bookings/:id', requireCustomerAuth, getBookingById)
router.post('/bookings/:id/cancel', requireCustomerAuth, cancelBooking)

export default router
