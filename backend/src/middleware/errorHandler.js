import { env } from '../config/env.js'
import { sendError } from '../utils/apiResponse.js'

export const errorHandler = (err, _req, res, _next) => {
  const statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode)
  const message = err.message || 'Internal Server Error'

  const errors = env.NODE_ENV === 'development'
    ? { stack: err.stack, details: err.details || null }
    : null

  console.error(`[Error] ${statusCode} - ${message}`)
  if (err.stack) {
    console.error(err.stack)
  }

  return sendError(res, message, statusCode, errors)
}
