import mysql from 'mysql2/promise'
import { env } from './env.js'

let pool = null

export const getPool = () => {
  if (!pool) {
    pool = mysql.createPool({
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
    })
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
