import cors from 'cors'
import express from 'express'
import { env } from './config/env.js'
import { errorHandler } from './middleware/errorHandler.js'
import { notFound } from './middleware/notFound.js'
import apiRouter from './routes/api.js'

const app = express()

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    // Allow all origins (localhost, 127.0.0.1, mobile apps, tools)
    return callback(null, true)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}

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
