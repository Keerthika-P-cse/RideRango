import app from './app.js'
import { env } from './config/env.js'

const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`[RideRango API] Server running in ${env.NODE_ENV} mode on port ${env.PORT} (0.0.0.0)`)
  console.log(`[RideRango API] Health check endpoint: http://localhost:${env.PORT}${env.API_PREFIX}/health`)
})

// Graceful shutdown handling
const shutdown = (signal) => {
  console.log(`[RideRango API] Received ${signal}. Shutting down gracefully...`)
  server.close(() => {
    console.log('[RideRango API] HTTP server closed.')
    process.exit(0)
  })
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

export default server
