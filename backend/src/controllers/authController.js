import authService from '../services/authService.js'
import { sendSuccess, sendError } from '../utils/apiResponse.js'

export const login = async (req, res) => {
  try {
    const { email, password } = req.body
    const result = await authService.loginCustomer(email, password)
    return sendSuccess(res, 'Login successful', result)
  } catch (error) {
    return sendError(res, error.message, 401)
  }
}

export const register = async (req, res) => {
  try {
    const result = await authService.registerCustomer(req.body)
    return sendSuccess(res, 'Registration successful', result, 201)
  } catch (error) {
    return sendError(res, error.message, 400)
  }
}

export const getMe = async (req, res) => {
  try {
    const customer = await authService.getCustomerProfile(req.customer.id)
    return sendSuccess(res, 'Profile retrieved', customer)
  } catch (error) {
    return sendError(res, error.message, 404)
  }
}
