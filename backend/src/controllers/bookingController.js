import bookingService from '../services/bookingService.js'
import { sendSuccess, sendError } from '../utils/apiResponse.js'

export const checkAvailability = async (req, res) => {
  try {
    const { vehicleId } = req.params
    const { startDate, endDate, excludeBookingId } = req.query
    const result = await bookingService.checkAvailability(vehicleId, startDate, endDate, excludeBookingId)
    return sendSuccess(res, 'Availability checked', result)
  } catch (error) {
    return sendError(res, error.message, 400)
  }
}

export const createBooking = async (req, res) => {
  try {
    const customerId = req.customer.id
    const booking = await bookingService.createBooking(customerId, req.body)
    return sendSuccess(res, 'Booking created successfully', booking, 201)
  } catch (error) {
    const isConflict =
      error.message.includes('reserved by another customer') ||
      error.message.includes('Already Booked') ||
      error.message.includes('Currently Rented')
    const status = isConflict ? 409 : 400
    return sendError(res, error.message, status)
  }
}

export const getMyBookings = async (req, res) => {
  try {
    const customerId = req.customer.id
    const bookings = await bookingService.getCustomerBookings(customerId)
    return sendSuccess(res, 'Customer bookings retrieved', bookings)
  } catch (error) {
    return sendError(res, error.message, 500)
  }
}

export const getBookingById = async (req, res) => {
  try {
    const customerId = req.customer.id
    const { id } = req.params
    const booking = await bookingService.getBookingById(id, customerId)
    return sendSuccess(res, 'Booking retrieved successfully', booking)
  } catch (error) {
    return sendError(res, error.message, 404)
  }
}

export const cancelBooking = async (req, res) => {
  try {
    const customerId = req.customer.id
    const { id } = req.params
    const { reason } = req.body
    const result = await bookingService.cancelBooking(id, customerId, reason)
    return sendSuccess(res, 'Booking cancelled successfully', result)
  } catch (error) {
    return sendError(res, error.message, 400)
  }
}
