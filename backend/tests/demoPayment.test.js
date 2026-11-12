import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { paymentService } from '../src/services/paymentService.js'
import { bookingService } from '../src/services/bookingService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '../..')

function futureStartDate() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
}

function createDemoMockPool(initialState = {}) {
  const state = {
    bookings: initialState.bookings ? initialState.bookings.map(b => ({ ...b })) : [],
    payments: initialState.payments ? initialState.payments.map(p => ({ ...p })) : [],
    vehicles: initialState.vehicles ? initialState.vehicles.map(v => ({ ...v })) : [],
    customers: initialState.customers ? initialState.customers.map(c => ({ ...c })) : [
      { id: 5, first_name: 'Test', last_name: 'User', email: 'test@example.com', phone: '9876543210' }
    ],
    nextPaymentId: 200,
    committed: false,
    rolledBack: false,
    released: false,
    lockOrder: []
  }

  const runQuery = async (sql, params = []) => {
    const normalized = sql.replace(/\s+/g, ' ').trim()

    // createPaymentOrder booking lookup
    if (normalized.startsWith('SELECT b.*, v.make, v.model, c.first_name')) {
      const [bookingId, customerId] = params
      const rows = state.bookings
        .filter(b => b.id === bookingId && b.customer_id === customerId)
        .map(b => {
          const v = state.vehicles.find(veh => veh.id === b.vehicle_id) || { make: 'Honda', model: 'Activa 6G' }
          const c = state.customers.find(cust => cust.id === b.customer_id) || {
            first_name: 'Test', last_name: 'User', email: 'test@example.com', phone: '9876543210'
          }
          return { ...c, make: v.make, model: v.model, ...b }
        })
      return [rows]
    }

    // createPaymentOrder insert initiated payment
    if (normalized.startsWith("INSERT INTO payments (transaction_reference, booking_id, customer_id, amount, payment_type, payment_method, payment_status, gateway_transaction_id, payment_notes) VALUES (?, ?, ?, ?, 'rental_fee', 'upi', 'initiated'")) {
      const [txnRef, bookingId, customerId, amount, orderId, notes] = params
      const id = state.nextPaymentId++
      state.payments.push({
        id,
        transaction_reference: txnRef,
        booking_id: bookingId,
        customer_id: customerId,
        amount: String(amount),
        payment_type: 'rental_fee',
        payment_method: 'upi',
        payment_status: 'initiated',
        gateway_transaction_id: orderId,
        payment_notes: notes
      })
      return [{ insertId: id }]
    }

    // Consistent lock lookup: vehicle_id
    if (normalized.startsWith('SELECT vehicle_id FROM bookings WHERE id = ? AND customer_id = ?')) {
      const [id, customerId] = params
      const rows = state.bookings
        .filter(b => b.id === id && b.customer_id === customerId)
        .map(b => ({ vehicle_id: b.vehicle_id }))
      return [rows]
    }

    if (normalized.startsWith('SELECT id, availability_status FROM vehicles WHERE id = ? FOR UPDATE')) {
      const [vehicleId] = params
      state.lockOrder.push('vehicles')
      const rows = state.vehicles
        .filter(v => v.id === vehicleId)
        .map(v => ({ id: v.id, availability_status: v.availability_status }))
      return [rows]
    }

    if (normalized.startsWith('SELECT id, vehicle_id, booking_reference, total_amount, booking_status FROM bookings WHERE id = ? AND customer_id = ? FOR UPDATE')) {
      const [id, customerId] = params
      state.lockOrder.push('bookings')
      const rows = state.bookings.filter(b => b.id === id && b.customer_id === customerId)
      return [rows]
    }

    // cancelBooking booking FOR UPDATE
    if (normalized.startsWith('SELECT * FROM bookings WHERE id = ? AND customer_id = ? FOR UPDATE')) {
      const [id, customerId] = params
      state.lockOrder.push('bookings')
      const rows = state.bookings.filter(b => b.id === id && b.customer_id === customerId)
      return [rows]
    }

    // processDemoPayment existing success check
    if (normalized.startsWith("SELECT id FROM payments WHERE booking_id = ? AND payment_status = 'success' AND payment_type != 'refund'")) {
      const [bookingId] = params
      const rows = state.payments
        .filter(p => p.booking_id === bookingId && p.payment_status === 'success' && p.payment_type !== 'refund')
        .slice(0, 1)
      return [rows]
    }

    // processDemoPayment order lookup
    if (normalized.startsWith('SELECT id, amount, payment_status FROM payments WHERE booking_id = ? AND customer_id = ? AND gateway_transaction_id = ?')) {
      const [bookingId, customerId, orderId] = params
      const rows = state.payments
        .filter(p => p.booking_id === bookingId && p.customer_id === customerId && p.gateway_transaction_id === orderId)
        .sort((a, b) => b.id - a.id)
        .slice(0, 1)
      return [rows]
    }

    // processDemoPayment success update
    if (normalized.startsWith("UPDATE payments SET payment_status = 'success', gateway_transaction_id = ?, payment_method = ?, paid_at = NOW(), payment_notes = 'DEMO PAYMENT")) {
      const [paymentId, method, id] = params
      const row = state.payments.find(p => p.id === id)
      if (row) {
        row.payment_status = 'success'
        row.gateway_transaction_id = paymentId
        row.payment_method = method
        row.payment_notes = 'DEMO PAYMENT (Simulated - No real money transferred)'
      }
      return [{ affectedRows: row ? 1 : 0 }]
    }

    // processDemoPayment failed update
    if (normalized.startsWith("UPDATE payments SET payment_status = 'failed', payment_method = ?, payment_notes = ? WHERE id = ?")) {
      const [method, notes, id] = params
      const row = state.payments.find(p => p.id === id)
      if (row) {
        row.payment_status = 'failed'
        row.payment_method = method
        row.payment_notes = notes
      }
      return [{ affectedRows: row ? 1 : 0 }]
    }

    if (normalized.startsWith("UPDATE bookings SET booking_status = 'confirmed'")) {
      const [bookingId] = params
      const row = state.bookings.find(b => b.id === bookingId)
      if (row) row.booking_status = 'confirmed'
      return [{ affectedRows: row ? 1 : 0 }]
    }

    if (normalized.startsWith("UPDATE vehicles SET availability_status = 'booked'")) {
      const [vehicleId] = params
      const row = state.vehicles.find(v => v.id === vehicleId)
      if (row) row.availability_status = 'booked'
      return [{ affectedRows: row ? 1 : 0 }]
    }

    // cancelBooking queries
    if (normalized.startsWith("SELECT id, amount, payment_method, transaction_reference FROM payments WHERE booking_id = ? AND customer_id = ? AND payment_status = 'success' AND payment_type != 'refund'")) {
      const [bookingId, customerId] = params
      const rows = state.payments
        .filter(p => p.booking_id === bookingId && p.customer_id === customerId && p.payment_status === 'success' && p.payment_type !== 'refund')
        .sort((a, b) => b.id - a.id)
        .slice(0, 1)
      return [rows]
    }

    if (normalized.startsWith("SELECT id, transaction_reference, payment_status FROM payments WHERE booking_id = ? AND payment_type = 'refund'")) {
      const [bookingId] = params
      const rows = state.payments.filter(p => p.booking_id === bookingId && p.payment_type === 'refund')
      return [rows]
    }

    if (normalized.startsWith("INSERT INTO payments (transaction_reference, booking_id, customer_id, amount, payment_type, payment_method, payment_status, gateway_transaction_id, payment_notes) VALUES (?, ?, ?, ?, 'refund'")) {
      const [txnRef, bookingId, customerId, amount, method, gatewayId, notes] = params
      const id = state.nextPaymentId++
      state.payments.push({
        id,
        transaction_reference: txnRef,
        booking_id: bookingId,
        customer_id: customerId,
        amount: String(amount),
        payment_type: 'refund',
        payment_method: method,
        payment_status: 'initiated',
        gateway_transaction_id: gatewayId,
        payment_notes: notes
      })
      return [{ insertId: id }]
    }

    if (normalized.startsWith("UPDATE payments SET payment_status = 'refunded'")) {
      const [notes, id] = params
      const row = state.payments.find(p => p.id === id)
      if (row) {
        row.payment_status = 'refunded'
        row.payment_notes = notes
      }
      return [{ affectedRows: row ? 1 : 0 }]
    }

    if (normalized.startsWith("UPDATE bookings SET booking_status = 'cancelled'")) {
      const [reason, bookingId] = params
      const row = state.bookings.find(b => b.id === bookingId)
      if (row) {
        row.booking_status = 'cancelled'
        row.cancellation_reason = reason
      }
      return [{ affectedRows: row ? 1 : 0 }]
    }

    if (normalized.startsWith("SELECT id FROM bookings WHERE vehicle_id = ? AND booking_status IN ('confirmed', 'active') AND id != ?")) {
      const [vehicleId, excludeId] = params
      const rows = state.bookings.filter(
        b => b.vehicle_id === vehicleId && b.id !== excludeId && (b.booking_status === 'confirmed' || b.booking_status === 'active')
      )
      return [rows]
    }

    if (normalized.startsWith("UPDATE vehicles SET availability_status = 'available'")) {
      const [vehicleId] = params
      const row = state.vehicles.find(v => v.id === vehicleId)
      if (row) row.availability_status = 'available'
      return [{ affectedRows: row ? 1 : 0 }]
    }

    throw new Error(`Unexpected SQL in demo mock pool: ${normalized}`)
  }

  const connection = {
    async beginTransaction() {},
    async commit() {
      state.committed = true
    },
    async rollback() {
      state.rolledBack = true
    },
    release() {
      state.released = true
    },
    query: runQuery
  }

  return {
    state,
    pool: {
      query: runQuery,
      async getConnection() {
        return connection
      }
    }
  }
}

test('1. Successful demo payment creates simulated success record, confirms booking, and reserves vehicle without calling Razorpay', async () => {
  const { pool, state } = createDemoMockPool({
    bookings: [{
      id: 51,
      customer_id: 5,
      vehicle_id: 2,
      booking_reference: 'RR-BK-DEMO-51',
      total_amount: '1500.00',
      booking_status: 'pending',
      start_date: futureStartDate()
    }],
    vehicles: [{ id: 2, make: 'Honda', model: 'Activa 6G', availability_status: 'available' }]
  })

  const order = await paymentService.createPaymentOrder(51, 5, pool, { demoMode: true, razorpayClient: null })
  assert.equal(order.demoMode, true)
  assert.match(order.orderId, /^DEMO-ORD-/)
  assert.equal(order.keyId, null)

  const res = await paymentService.processDemoPayment(
    5,
    { booking_id: 51, order_id: order.orderId, outcome: 'success', payment_method: 'upi' },
    pool,
    { demoMode: true }
  )

  assert.equal(res.success, true)
  assert.equal(res.demoMode, true)
  assert.equal(res.outcome, 'success')
  assert.equal(res.status, 'confirmed')
  assert.match(res.paymentId, /^DEMO-PAY-/)
  assert.equal(state.committed, true)
  assert.equal(state.bookings[0].booking_status, 'confirmed')
  assert.equal(state.vehicles[0].availability_status, 'booked')
  assert.equal(state.payments[0].payment_status, 'success')
  assert.match(state.payments[0].payment_notes, /DEMO PAYMENT/i)
  assert.deepEqual(state.lockOrder, ['vehicles', 'bookings'])
})

test('2. Failed demo payment records failed attempt, leaves booking pending and vehicle available, and creates no refund', async () => {
  const { pool, state } = createDemoMockPool({
    bookings: [{
      id: 52,
      customer_id: 5,
      vehicle_id: 2,
      booking_reference: 'RR-BK-DEMO-52',
      total_amount: '1500.00',
      booking_status: 'pending',
      start_date: futureStartDate()
    }],
    vehicles: [{ id: 2, make: 'Honda', model: 'Activa 6G', availability_status: 'available' }]
  })

  const order = await paymentService.createPaymentOrder(52, 5, pool, { demoMode: true, razorpayClient: null })
  const res = await paymentService.processDemoPayment(
    5,
    {
      booking_id: 52,
      order_id: order.orderId,
      outcome: 'failed',
      payment_method: 'upi',
      failure_reason: 'Simulated payment failure for academic demonstration'
    },
    pool,
    { demoMode: true }
  )

  assert.equal(res.success, false)
  assert.equal(res.demoMode, true)
  assert.equal(res.outcome, 'failed')
  assert.equal(res.paymentStatus, 'failed')
  assert.equal(res.bookingStatus, 'pending')
  assert.equal(res.failureReason, 'Simulated payment failure for academic demonstration')
  assert.equal(state.committed, true)
  assert.equal(state.bookings[0].booking_status, 'pending')
  assert.equal(state.vehicles[0].availability_status, 'available')
  assert.equal(state.payments.length, 1)
  assert.equal(state.payments[0].payment_status, 'failed')
  assert.match(state.payments[0].payment_notes, /Simulated payment failure for academic demonstration/)
  assert.equal(state.payments.filter(p => p.payment_type === 'refund').length, 0)
})

test('3. Failed demo payment can be retried and then confirmed via successful demo payment', async () => {
  const { pool, state } = createDemoMockPool({
    bookings: [{
      id: 53,
      customer_id: 5,
      vehicle_id: 2,
      booking_reference: 'RR-BK-DEMO-53',
      total_amount: '1200.00',
      booking_status: 'pending',
      start_date: futureStartDate()
    }],
    vehicles: [{ id: 2, make: 'Honda', model: 'Activa 6G', availability_status: 'available' }]
  })

  const order1 = await paymentService.createPaymentOrder(53, 5, pool, { demoMode: true, razorpayClient: null })
  const failRes = await paymentService.processDemoPayment(
    5,
    { booking_id: 53, order_id: order1.orderId, outcome: 'failed' },
    pool,
    { demoMode: true }
  )
  assert.equal(failRes.outcome, 'failed')
  assert.equal(state.bookings[0].booking_status, 'pending')

  const order2 = await paymentService.createPaymentOrder(53, 5, pool, { demoMode: true, razorpayClient: null })
  const okRes = await paymentService.processDemoPayment(
    5,
    { booking_id: 53, order_id: order2.orderId, outcome: 'success' },
    pool,
    { demoMode: true }
  )

  assert.equal(okRes.success, true)
  assert.equal(okRes.status, 'confirmed')
  assert.equal(state.bookings[0].booking_status, 'confirmed')
  assert.equal(state.vehicles[0].availability_status, 'booked')
  assert.equal(state.payments[0].payment_status, 'failed')
  assert.equal(state.payments[1].payment_status, 'success')
})

test('4. Duplicate demo success is idempotent and failed demo attempt cannot overwrite existing success', async () => {
  const { pool, state } = createDemoMockPool({
    bookings: [{
      id: 54,
      customer_id: 5,
      vehicle_id: 2,
      booking_reference: 'RR-BK-DEMO-54',
      total_amount: '1800.00',
      booking_status: 'confirmed',
      start_date: futureStartDate()
    }],
    payments: [{
      id: 300,
      booking_id: 54,
      customer_id: 5,
      amount: '1800.00',
      payment_type: 'rental_fee',
      payment_status: 'success',
      gateway_transaction_id: 'DEMO-PAY-EXISTING'
    }],
    vehicles: [{ id: 2, availability_status: 'booked' }]
  })

  const dupSuccess = await paymentService.processDemoPayment(
    5,
    { booking_id: 54, order_id: 'DEMO-ORD-SECOND', outcome: 'success' },
    pool,
    { demoMode: true }
  )
  assert.equal(dupSuccess.success, true)
  assert.equal(dupSuccess.alreadyConfirmed, true)

  await assert.rejects(
    () => paymentService.processDemoPayment(
      5,
      { booking_id: 54, order_id: 'DEMO-ORD-SECOND', outcome: 'failed' },
      pool,
      { demoMode: true }
    ),
    /already paid and confirmed/
  )
  assert.equal(state.payments[0].payment_status, 'success')
})

test('5. Existing 100% DEMO refund workflow works cleanly after a successful demo payment', async () => {
  const { pool, state } = createDemoMockPool({
    bookings: [{
      id: 55,
      customer_id: 5,
      vehicle_id: 2,
      booking_reference: 'RR-BK-DEMO-55',
      total_amount: '2100.00',
      booking_status: 'pending',
      start_date: futureStartDate()
    }],
    vehicles: [{ id: 2, make: 'Honda', model: 'Activa 6G', availability_status: 'available' }]
  })

  const order = await paymentService.createPaymentOrder(55, 5, pool, { demoMode: true, razorpayClient: null })
  await paymentService.processDemoPayment(
    5,
    { booking_id: 55, order_id: order.orderId, outcome: 'success' },
    pool,
    { demoMode: true }
  )
  assert.equal(state.bookings[0].booking_status, 'confirmed')
  assert.equal(state.vehicles[0].availability_status, 'booked')

  const cancelRes = await bookingService.cancelBooking(55, 5, 'Faculty demo cancellation', pool)
  assert.equal(cancelRes.booking_status, 'cancelled')
  assert.equal(cancelRes.refund_amount, 2100)
  assert.equal(cancelRes.refund_status, 'refunded')
  assert.equal(state.vehicles[0].availability_status, 'available')
  assert.equal(state.payments.filter(p => p.payment_type === 'refund').length, 1)
})

test('6. Demo mode disabled rejects both success and failed demo payment paths with 403', async () => {
  const { pool } = createDemoMockPool({
    bookings: [{
      id: 56,
      customer_id: 5,
      vehicle_id: 2,
      booking_reference: 'RR-BK-DEMO-56',
      total_amount: '999.00',
      booking_status: 'pending'
    }],
    vehicles: [{ id: 2, availability_status: 'available' }]
  })

  await assert.rejects(
    () => paymentService.createPaymentOrder(56, 5, pool, { demoMode: false, razorpayClient: null }),
    /not configured/
  )

  await assert.rejects(
    () => paymentService.processDemoPayment(
      5,
      { booking_id: 56, order_id: 'DEMO-ORD-X', outcome: 'success' },
      pool,
      { demoMode: false }
    ),
    (err) => {
      assert.equal(err.statusCode, 403)
      assert.match(err.message, /Demo payment mode is not enabled/)
      return true
    }
  )

  await assert.rejects(
    () => paymentService.processDemoPayment(
      5,
      { booking_id: 56, order_id: 'DEMO-ORD-X', outcome: 'failed' },
      pool,
      { demoMode: false }
    ),
    (err) => {
      assert.equal(err.statusCode, 403)
      assert.match(err.message, /Demo payment mode is not enabled/)
      return true
    }
  )
})

test('7. Customer and admin UI pages clearly label DEMO PAYMENT (Simulated) separately from real payments and demo refunds', () => {
  const uiFiles = [
    'frontend/src/pages/customer/MyBookingsPage.jsx',
    'frontend/src/pages/admin/AdminBookingsPage.jsx',
    'frontend/src/pages/admin/AdminPaymentsPage.jsx'
  ]

  for (const relPath of uiFiles) {
    const content = fs.readFileSync(path.join(repoRoot, relPath), 'utf8')
    assert.match(content, /gateway_transaction_id/, `${relPath} should inspect gateway_transaction_id`)
    assert.match(content, /DEMO-/, `${relPath} should detect DEMO- prefix`)
    assert.match(content, /DEMO PAYMENT \(Simulated\)/, `${relPath} should display DEMO PAYMENT (Simulated)`)
    assert.match(content, /DEMO Refund/i, `${relPath} should keep demo refund labelling`)
  }
})

test('8. getBookedDates returns upcoming active booking ranges without exposing customer PII', async () => {
  const fakePool = {
    async query(sql, params) {
      const normalized = sql.replace(/\s+/g, ' ').trim()
      if (normalized.startsWith('SELECT id, availability_status, is_active FROM vehicles WHERE id = ?')) {
        const [vehicleId] = params
        if (vehicleId === 999) return [[]]
        return [[{ id: vehicleId, availability_status: 'available', is_active: 1 }]]
      }
      if (normalized.startsWith('SELECT start_date, end_date, booking_status FROM bookings WHERE vehicle_id = ?')) {
        return [[
          {
            start_date: '2026-11-20T10:00:00.000Z',
            end_date: '2026-11-22T10:00:00.000Z',
            booking_status: 'confirmed',
            // Even if query returned internal or secret customer columns, getBookedDates must not leak them
            customer_id: 123,
            customer_name: 'John Doe',
            customer_phone: '9999999999'
          }
        ]]
      }
      return [[]]
    }
  }

  const result = await bookingService.getBookedDates(1, fakePool)
  assert.equal(result.vehicleId, 1)
  assert.equal(result.availability_status, 'available')
  assert.equal(result.bookedRanges.length, 1)

  const range = result.bookedRanges[0]
  assert.equal(range.start_date, '2026-11-20T10:00:00.000Z')
  assert.equal(range.end_date, '2026-11-22T10:00:00.000Z')
  assert.equal(range.booking_status, 'confirmed')

  // Verify privacy: no PII keys present
  assert.equal('customer_id' in range, false)
  assert.equal('customer_name' in range, false)
  assert.equal('customer_phone' in range, false)

  await assert.rejects(
    () => bookingService.getBookedDates(999, fakePool),
    /Vehicle not found or inactive/
  )
})

test('9. Backend booking conflict protection: prevents overlapping bookings, allows non-overlapping, and serializes concurrent requests', async () => {
  // Shared mock state for vehicle 10
  const state = {
    bookings: [
      {
        id: 101,
        vehicle_id: 10,
        customer_id: 1,
        booking_reference: 'RR-BK-EXISTING',
        booking_status: 'confirmed',
        start_date: new Date('2026-12-05T10:00:00Z'),
        end_date: new Date('2026-12-10T10:00:00Z')
      }
    ],
    nextBookingId: 102,
    lockOwner: null
  }

  const createConflictMockPool = () => ({
    async getConnection() {
      return {
        async beginTransaction() {},
        async commit() {},
        async rollback() {},
        release() {
          if (state.lockOwner === this) {
            state.lockOwner = null
          }
        },
        async query(sql, params) {
          const norm = sql.replace(/\s+/g, ' ').trim()

          // Vehicle lookup FOR UPDATE
          if (norm.startsWith('SELECT id, make, model, registration_number, daily_rate, security_deposit, availability_status, location, is_active FROM vehicles WHERE id = ? FOR UPDATE')) {
            const [vehicleId] = params
            if (vehicleId === 10) {
              // Simulate row-level locking
              if (state.lockOwner && state.lockOwner !== this) {
                // Wait briefly for lock release if concurrent
                let count = 0
                while (state.lockOwner && state.lockOwner !== this && count < 20) {
                  await new Promise((r) => setTimeout(r, 10))
                  count++
                }
              }
              state.lockOwner = this
              return [[{
                id: 10,
                make: 'Maruti Suzuki',
                model: 'Baleno Alpha',
                registration_number: 'KA-01-RR-1010',
                daily_rate: '1799.00',
                security_deposit: '3000.00',
                availability_status: 'available',
                location: 'Koramangala Hub',
                is_active: 1
              }]]
            }
            return [[]]
          }

          // Overlap check query inside createBooking
          if (norm.startsWith('SELECT id, booking_reference FROM bookings WHERE vehicle_id = ? AND booking_status IN (\'pending\', \'confirmed\', \'active\') AND start_date < ? AND end_date > ? FOR UPDATE')) {
            const [vehicleId, end, start] = params
            const reqStart = new Date(start)
            const reqEnd = new Date(end)
            const conflicts = state.bookings.filter((b) =>
              b.vehicle_id === vehicleId &&
              ['pending', 'confirmed', 'active'].includes(b.booking_status) &&
              b.start_date < reqEnd &&
              b.end_date > reqStart
            )
            return [conflicts]
          }

          // Customer update
          if (norm.startsWith('UPDATE customers')) {
            return [{ affectedRows: 1 }]
          }

          // Insert booking
          if (norm.startsWith('INSERT INTO bookings')) {
            const id = state.nextBookingId++
            const [
              ref, custId, vehId, st, en, days, daily, rental, dep,
              tax, total, pick, drop, notes
            ] = params
            state.bookings.push({
              id,
              booking_reference: ref,
              customer_id: custId,
              vehicle_id: vehId,
              start_date: new Date(st),
              end_date: new Date(en),
              booking_status: 'pending'
            })
            return [{ insertId: id }]
          }

          return [[]]
        }
      }
    }
  })

  // Test 9.1: Overlapping booking request is rejected by backend
  // Overlaps existing 2026-12-05 to 2026-12-10 window
  const mockConnPool = createConflictMockPool()
  const origGetConn = (await import('../src/config/db.js')).default.getConnection
  ;(await import('../src/config/db.js')).default.getConnection = mockConnPool.getConnection

  try {
    // Exact overlap
    await assert.rejects(
      () => bookingService.createBooking(5, {
        vehicle_id: 10,
        start_date: '2026-12-06T10:00:00Z',
        end_date: '2026-12-08T10:00:00Z',
        pickup_location: 'Koramangala Hub',
        dropoff_location: 'Koramangala Hub'
      }),
      /This vehicle has just been reserved by another customer for these dates/
    )

    // Test 9.2: Non-overlapping booking request succeeds
    // Window 2026-12-12 to 2026-12-15 is after 2026-12-10
    const nonOverlapRes = await bookingService.createBooking(5, {
      vehicle_id: 10,
      start_date: '2026-12-12T10:00:00Z',
      end_date: '2026-12-15T10:00:00Z',
      pickup_location: 'Koramangala Hub',
      dropoff_location: 'Koramangala Hub'
    })
    assert.ok(nonOverlapRes.id)
    assert.equal(nonOverlapRes.booking_status, 'pending')

    // Test 9.3: Concurrent requests competing for the exact same newly available window
    // Window: 2026-12-20 to 2026-12-22
    const targetWindow = {
      vehicle_id: 10,
      start_date: '2026-12-20T10:00:00Z',
      end_date: '2026-12-22T10:00:00Z',
      pickup_location: 'Koramangala Hub',
      dropoff_location: 'Koramangala Hub'
    }

    const results = await Promise.allSettled([
      bookingService.createBooking(6, targetWindow),
      bookingService.createBooking(7, targetWindow)
    ])

    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r) => r.status === 'rejected')

    assert.equal(fulfilled.length, 1, 'Exactly one concurrent booking request must succeed')
    assert.equal(rejected.length, 1, 'Conflicting concurrent booking request must be rejected')
    assert.match(rejected[0].reason.message, /reserved by another customer/)
  } finally {
    ;(await import('../src/config/db.js')).default.getConnection = origGetConn
  }
})
