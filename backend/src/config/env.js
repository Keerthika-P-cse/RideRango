import crypto from 'crypto'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const INSECURE_JWT_PLACEHOLDERS = new Set([
  'riderango_secure_jwt_secret_token_key_2026',
  'your_jwt_secret_key_change_in_production',
  'secret',
  'changeme'
])

/**
 * Resolve and validate JWT_SECRET.
 * Production fails fast if missing, placeholder, or shorter than 32 chars.
 * Non-production uses an ephemeral per-process secret if unset (no hardcoded fallback).
 */
export function resolveJwtSecret(
  nodeEnv = process.env.NODE_ENV || 'development',
  rawSecret = process.env.JWT_SECRET
) {
  const trimmed = typeof rawSecret === 'string' ? rawSecret.trim() : ''

  if (nodeEnv === 'production') {
    if (!trimmed || INSECURE_JWT_PLACEHOLDERS.has(trimmed.toLowerCase()) || trimmed.length < 32) {
      throw new Error(
        'FATAL: JWT_SECRET must be set to a strong secret (minimum 32 characters) in production.'
      )
    }
    return trimmed
  }

  if (trimmed) {
    return trimmed
  }

  console.warn('[RideRango] JWT_SECRET not set; generating ephemeral development secret for this process.')
  return crypto.randomBytes(32).toString('hex')
}

const NODE_ENV = process.env.NODE_ENV || 'development'

export const env = {
  NODE_ENV,
  PORT: parseInt(process.env.PORT, 10) || 5000,
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  API_PREFIX: process.env.API_PREFIX || '/api/v1',
  JWT_SECRET: resolveJwtSecret(NODE_ENV, process.env.JWT_SECRET),
  RAZORPAY: {
    KEY_ID: process.env.RAZORPAY_KEY_ID || 'rzp_test_RideRangoDevKey',
    KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || 'riderango_test_secret_key_dev'
  },
  DB: {
    HOST: process.env.DB_HOST || 'localhost',
    PORT: parseInt(process.env.DB_PORT, 10) || 3306,
    USER: process.env.DB_USER || 'root',
    PASSWORD: process.env.DB_PASSWORD || '',
    NAME: process.env.DB_NAME || 'riderango_db',
    CONNECTION_LIMIT: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
    SSL: process.env.DB_SSL ? process.env.DB_SSL === 'true' : (Boolean(process.env.DB_SSL_CA) || Boolean(process.env.DB_SSL_CA_CERT)),
    SSL_CA: process.env.DB_SSL_CA ? process.env.DB_SSL_CA.trim() : null,
    SSL_CA_CERT: process.env.DB_SSL_CA_CERT ? process.env.DB_SSL_CA_CERT.trim() : null
  }
}
