import { sendError } from '../utils/apiResponse.js'

export const notFound = (req, res, _next) => {
  return sendError(res, `Endpoint not found: [${req.method}] ${req.originalUrl}`, 404)
}
