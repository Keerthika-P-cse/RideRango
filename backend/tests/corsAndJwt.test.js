import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import { env, resolveJwtSecret } from '../src/config/env.js'
import { getPool } from '../src/config/db.js'
import app, { createCorsOptions, isOriginAllowed } from '../src/app.js'
import { errorHandler } from '../src/middleware/errorHandler.js'

test.after(async () => {
  await getPool().end().catch(() => {})
})

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const backendRoot = path.resolve(__dirname, '..')

function startServer(expressApp) {
  return new Promise((resolve) => {
    const server = http.createServer(expressApp)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` })
    })
  })
}

test('CORS: allows production frontend origin and rejects unknown origins', async () => {
  const { server, baseUrl } = await startServer(app)
  try {
    // Allowed production origin (GET)
    const allowedRes = await fetch(`${baseUrl}/api/v1/categories`, {
      headers: { Origin: 'https://riderango.vercel.app' }
    })
    assert.equal(allowedRes.headers.get('access-control-allow-origin'), 'https://riderango.vercel.app')
    assert.equal(allowedRes.headers.get('access-control-allow-credentials'), 'true')

    // Allowed production origin (OPTIONS preflight)
    const preflightAllowed = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://riderango.vercel.app',
        'Access-Control-Request-Method': 'POST'
      }
    })
    assert.equal(preflightAllowed.status, 204)
    assert.equal(preflightAllowed.headers.get('access-control-allow-origin'), 'https://riderango.vercel.app')

    // Unknown origin rejected (GET)
    const evilRes = await fetch(`${baseUrl}/api/v1/categories`, {
      headers: { Origin: 'https://evil.example' }
    })
    assert.equal(evilRes.status, 403)
    assert.equal(evilRes.headers.get('access-control-allow-origin'), null)

    // Unknown origin rejected (OPTIONS preflight)
    const preflightEvil = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://evil.example',
        'Access-Control-Request-Method': 'POST'
      }
    })
    assert.equal(preflightEvil.status, 403)
    assert.equal(preflightEvil.headers.get('access-control-allow-origin'), null)
  } finally {
    server.closeAllConnections?.()
    await new Promise((r) => server.close(r))
  }
})

test('CORS: allows localhost in development and blocks localhost in production', async () => {
  assert.equal(isOriginAllowed('http://localhost:5173', 'development', 'http://localhost:5173'), true)
  assert.equal(isOriginAllowed('http://127.0.0.1:5173', 'development', 'http://localhost:5173'), true)
  assert.equal(isOriginAllowed('http://localhost:5173', 'production', 'http://localhost:5173'), false)
  assert.equal(isOriginAllowed('https://riderango.vercel.app', 'production', 'http://localhost:5173'), true)
  assert.equal(isOriginAllowed('https://evil.example', 'development', 'http://localhost:5173'), false)

  // Verify HTTP behavior under production CORS options
  const prodApp = express()
  const prodCors = createCorsOptions('production', 'http://localhost:5173')
  prodApp.use(cors(prodCors))
  prodApp.options('*', cors(prodCors))
  prodApp.get('/ping', (_req, res) => res.json({ ok: true }))
  prodApp.use(errorHandler)

  const { server, baseUrl } = await startServer(prodApp)
  try {
    const localInProd = await fetch(`${baseUrl}/ping`, {
      headers: { Origin: 'http://localhost:5173' }
    })
    assert.equal(localInProd.status, 403)
    assert.equal(localInProd.headers.get('access-control-allow-origin'), null)

    const vercelInProd = await fetch(`${baseUrl}/ping`, {
      headers: { Origin: 'https://riderango.vercel.app' }
    })
    assert.equal(vercelInProd.status, 200)
    assert.equal(vercelInProd.headers.get('access-control-allow-origin'), 'https://riderango.vercel.app')
    assert.equal(vercelInProd.headers.get('access-control-allow-credentials'), 'true')
  } finally {
    server.closeAllConnections?.()
    await new Promise((r) => server.close(r))
  }
})

test('JWT: production rejects missing, short, or placeholder JWT_SECRET and fails fast on startup', () => {
  assert.throws(() => resolveJwtSecret('production', ''), /FATAL: JWT_SECRET/)
  assert.throws(() => resolveJwtSecret('production', undefined), /FATAL: JWT_SECRET/)
  assert.throws(() => resolveJwtSecret('production', 'short_secret_123'), /FATAL: JWT_SECRET/)
  assert.throws(
    () => resolveJwtSecret('production', 'riderango_secure_jwt_secret_token_key_2026'),
    /FATAL: JWT_SECRET/
  )

  const strongSecret = 'a_strong_32_plus_char_production_secret_key'
  assert.equal(resolveJwtSecret('production', strongSecret), strongSecret)

  // Development without secret generates an ephemeral 64-hex secret (no hardcoded fallback)
  const devSecret1 = resolveJwtSecret('development', '')
  const devSecret2 = resolveJwtSecret('development', '')
  assert.match(devSecret1, /^[a-f0-9]{64}$/)
  assert.notEqual(devSecret1, devSecret2)

  // Real subprocess startup test in production without JWT_SECRET
  const child = spawnSync(
    process.execPath,
    ['-e', "import('./src/config/env.js').catch(e => { console.error(e.message); process.exit(1); })"],
    {
      cwd: backendRoot,
      env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: '' },
      encoding: 'utf8'
    }
  )
  assert.notEqual(child.status, 0)
  assert.match(child.stderr, /FATAL: JWT_SECRET/)
})

test('JWT & Protected Routes: rejects unauthenticated/invalid tokens and preserves token format', async () => {
  // Token format round-trip (customer and staff)
  const customerToken = jwt.sign(
    { id: 1, email: 'cust@example.com', role: 'customer', type: 'customer' },
    env.JWT_SECRET,
    { expiresIn: '7d' }
  )
  const decodedCustomer = jwt.verify(customerToken, env.JWT_SECRET)
  assert.equal(decodedCustomer.id, 1)
  assert.equal(decodedCustomer.role, 'customer')

  const staffToken = jwt.sign(
    { id: 1, email: 'staff@example.com', role: 'admin', type: 'staff' },
    env.JWT_SECRET,
    { expiresIn: '12h' }
  )
  const decodedStaff = jwt.verify(staffToken, env.JWT_SECRET)
  assert.equal(decodedStaff.type, 'staff')
  assert.equal(decodedStaff.role, 'admin')

  // Protected route enforcement via HTTP
  const { server, baseUrl } = await startServer(app)
  try {
    const noAuthMe = await fetch(`${baseUrl}/api/v1/auth/me`)
    assert.equal(noAuthMe.status, 401)

    const badJwtMe = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: 'Bearer invalid.jwt.token' }
    })
    assert.equal(badJwtMe.status, 401)

    const noAuthAdmin = await fetch(`${baseUrl}/api/v1/admin/vehicles`)
    assert.equal(noAuthAdmin.status, 401)
  } finally {
    server.closeAllConnections?.()
    await new Promise((r) => server.close(r))
  }
})
