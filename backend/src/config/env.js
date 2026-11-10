import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env from backend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  API_PREFIX: process.env.API_PREFIX || '/api/v1',
  JWT_SECRET: process.env.JWT_SECRET || 'riderango_secure_jwt_secret_token_key_2026',
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
    CONNECTION_LIMIT: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10
  }
}
