import cors from 'cors'
import express from 'express'
import { env } from './config/env.js'
import { errorHandler } from './middleware/errorHandler.js'
import { notFound } from './middleware/notFound.js'
import apiRouter from './routes/api.js'

const app = express()

const PRODUCTION_ALLOWED_ORIGINS = ['https://riderango.vercel.app']
const LOCALHOST_ORIGIN_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/i

/**
 * Determine whether a request Origin is permitted under the active environment.
 */
export function isOriginAllowed(
  origin,
  nodeEnv = env.NODE_ENV,
  clientUrl = env.CLIENT_URL
) {
  if (!origin || typeof origin !== 'string') {
    return false
  }

  const configuredOrigins = String(clientUrl || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean)

  if (nodeEnv === 'production') {
    const prodAllowlist = new Set([
      ...PRODUCTION_ALLOWED_ORIGINS,
      ...configuredOrigins.filter(o => !LOCALHOST_ORIGIN_REGEX.test(o))
    ])
    return prodAllowlist.has(origin)
  }

  if (LOCALHOST_ORIGIN_REGEX.test(origin)) {
    return true
  }

  const devAllowlist = new Set([
    ...PRODUCTION_ALLOWED_ORIGINS,
    ...configuredOrigins
  ])
  return devAllowlist.has(origin)
}

/**
 * Build environment-aware CORS options with an explicit origin allowlist.
 */
export function createCorsOptions(
  nodeEnv = env.NODE_ENV,
  clientUrl = env.CLIENT_URL
) {
  return {
    origin: (origin, callback) => {
      // Allow non-browser / same-origin requests without an Origin header (no ACAO emitted)
      if (!origin) {
        return callback(null, false)
      }

      if (isOriginAllowed(origin, nodeEnv, clientUrl)) {
        return callback(null, true)
      }

      const corsError = new Error('Origin not allowed by CORS')
      corsError.statusCode = 403
      return callback(corsError)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
  }
}

// CORS configuration
const corsOptions = createCorsOptions()

app.use(cors(corsOptions))
app.options('*', cors(corsOptions))

// Body parsing
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// API v1 root mount
app.use(env.API_PREFIX, apiRouter)

// 404 Handler for unmatched routes
app.use(notFound)

// Centralised error handling middleware
app.use(errorHandler)

export default app
