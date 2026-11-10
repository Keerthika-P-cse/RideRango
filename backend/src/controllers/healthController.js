import { testDatabaseConnection } from '../config/db.js'
import { env } from '../config/env.js'
import { sendSuccess } from '../utils/apiResponse.js'

export const getHealth = async (_req, res, next) => {
  try {
    const dbStatus = await testDatabaseConnection()

    const healthData = {
      status: 'UP',
      service: 'RideRango Vehicle Rental Management System API',
      version: '1.0.0',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      database: {
        connected: dbStatus.connected,
        message: dbStatus.message,
        code: dbStatus.code || null
      }
    }

    return sendSuccess(res, 'RideRango API is healthy', healthData)
  } catch (error) {
    next(error)
  }
}
