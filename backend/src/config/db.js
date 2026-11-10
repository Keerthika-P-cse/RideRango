import fs from 'fs'
import mysql from 'mysql2/promise'
import { env } from './env.js'

let pool = null

const getSslConfig = () => {
  if (!env.DB.SSL) {
    return undefined
  }

  const sslConfig = {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  }

  // Support Render Secret Files or filesystem paths for TiDB Cloud CA certificate
  if (env.DB.SSL_CA) {
    const caPath = env.DB.SSL_CA
    if (!fs.existsSync(caPath)) {
      throw new Error(`Database TLS configuration error: Configured CA certificate path '${caPath}' does not exist or is inaccessible.`)
    }
    try {
      sslConfig.ca = fs.readFileSync(caPath, 'utf8')
    } catch (readErr) {
      throw new Error(`Database TLS configuration error: Unable to read CA certificate from '${caPath}': ${readErr.message}`)
    }
  } else if (env.DB.SSL_CA_CERT) {
    // Direct PEM certificate string provided via environment variable
    sslConfig.ca = env.DB.SSL_CA_CERT
  }

  return sslConfig
}

export const getPool = () => {
  if (!pool) {
    const poolConfig = {
      host: env.DB.HOST,
      port: env.DB.PORT,
      user: env.DB.USER,
      password: env.DB.PASSWORD,
      database: env.DB.NAME,
      waitForConnections: true,
      connectionLimit: env.DB.CONNECTION_LIMIT,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    }

    const ssl = getSslConfig()
    if (ssl) {
      poolConfig.ssl = ssl
    }

    pool = mysql.createPool(poolConfig)
  }
  return pool
}

export const testDatabaseConnection = async () => {
  try {
    const currentPool = getPool()
    const connection = await currentPool.getConnection()
    await connection.ping()
    connection.release()
    return {
      connected: true,
      message: 'Database connection established successfully'
    }
  } catch (error) {
    return {
      connected: false,
      message: error.message || 'Database connection failed',
      code: error.code
    }
  }
}

export const poolProxy = {
  query: (...args) => getPool().query(...args),
  getConnection: (...args) => getPool().getConnection(...args)
}

export default poolProxy
