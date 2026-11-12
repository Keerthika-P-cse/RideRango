import paymentService from '../services/paymentService.js'
import { sendSuccess, sendError } from '../utils/apiResponse.js'

export const createOrder = async (req, res) => {
  try {
    const customerId = req.customer.id
    const { booking_id } = req.body
    if (!booking_id) {
      return sendError(res, 'Booking ID is required.', 400)
    }

    const orderData = await paymentService.createPaymentOrder(booking_id, customerId)
    return sendSuccess(res, 'Payment order created', orderData)
  } catch (error) {
    return sendError(res, error.message, error.statusCode || 400)
  }
}

export const verifyPayment = async (req, res) => {
  try {
    const customerId = req.customer.id
    const result = await paymentService.verifyPayment(customerId, req.body)
    return sendSuccess(res, 'Payment verified successfully and booking confirmed', result)
  } catch (error) {
    return sendError(res, error.message, error.statusCode || 400)
  }
}

export const recordFailure = async (req, res) => {
  try {
    const customerId = req.customer.id
    const result = await paymentService.recordPaymentFailure(customerId, req.body)
    return sendSuccess(res, 'Payment failure recorded', result)
  } catch (error) {
    return sendError(res, error.message, error.statusCode || 400)
  }
}
