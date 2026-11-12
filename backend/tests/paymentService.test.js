import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { env } from '../src/config/env.js'
import { paymentService, verifyRazorpaySignature } from '../src/services/paymentService.js'

function sign(orderId, paymentId, secret = env.RAZORPAY.KEY_SECRET) {
  return crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex')
}

function createMockDbPool(initialState = {}) {
  const state = {
    bookings: initialState.bookings ? initialState.bookings.map(b => ({ ...b })) : [],
    payments: initialState.payments ? initialState.payments.map(p => ({ ...p })) : [],
    vehicles: initialState.vehicles ? initialState.vehicles.map(v => ({ ...v })) : [],
    committed: false,
    rolledBack: false,
    released: false,
    connectionRequested: false
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
    async query(sql, params = []) {
      const normalized = sql.replace(/\s+/g, ' ').trim()

      if (normalized.startsWith('SELECT vehicle_id FROM bookings WHERE id = ? AND customer_id = ?')) {
        const [id, customerId] = params
        const rows = state.bookings.filter(b => b.id === id && b.customer_id === customerId).map(b => ({ vehicle_id: b.vehicle_id }))
        return [rows]
      }

      if (normalized.startsWith('SELECT id, availability_status FROM vehicles WHERE id = ? FOR UPDATE')) {
        const [vehicleId] = params
        state.lockOrder = state.lockOrder || []
        state.lockOrder.push('vehicles')
        const rows = state.vehicles.filter(v => v.id === vehicleId).map(v => ({ id: v.id, availability_status: v.availability_status }))
        return [rows]
      }

      if (normalized.startsWith('SELECT id, vehicle_id, booking_reference, total_amount, booking_status FROM bookings')) {
        const [id, customerId] = params
        state.lockOrder = state.lockOrder || []
        state.lockOrder.push('bookings')
        const rows = state.bookings.filter(b => b.id === id && b.customer_id === customerId)
        return [rows]
      }

      if (normalized.startsWith('SELECT id, amount, payment_status FROM payments')) {
        const [bookingId, customerId, orderId] = params
        const rows = state.payments
          .filter(p => p.booking_id === bookingId && p.customer_id === customerId && p.gateway_transaction_id === orderId)
          .sort((a, b) => b.id - a.id)
          .slice(0, 1)
        return [rows]
      }

      if (normalized.startsWith("SELECT id FROM payments WHERE booking_id = ? AND payment_status = 'success'")) {
        const [bookingId] = params
        const rows = state.payments.filter(p => p.booking_id === bookingId && p.payment_status === 'success').slice(0, 1)
        return [rows]
      }

      if (normalized.startsWith('UPDATE payments SET payment_status')) {
        const [paymentId, method, id] = params
        const row = state.payments.find(p => p.id === id)
        if (row) {
          row.payment_status = 'success'
          row.gateway_transaction_id = paymentId
          row.payment_method = method
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

      throw new Error(`Unexpected SQL in mock pool: ${normalized}`)
    }
  }

  return {
    state,
    pool: {
      async getConnection() {
        state.connectionRequested = true
        return connection
      }
    }
  }
}

test('verifyRazorpaySignature validates legitimate HMAC-SHA256 signature and rejects malformed/wrong ones', () => {
  const orderId = 'order_test_valid_123'
  const paymentId = 'pay_test_valid_456'
  const validSig = sign(orderId, paymentId)

  assert.equal(verifyRazorpaySignature(orderId, paymentId, validSig), true)
  assert.equal(verifyRazorpaySignature(orderId, paymentId, '0'.repeat(64)), false)
  assert.equal(verifyRazorpaySignature(orderId, paymentId, 'test_signature_verified'), false)
  assert.equal(verifyRazorpaySignature(orderId, paymentId, ''), false)
  assert.equal(verifyRazorpaySignature(orderId, paymentId, null), false)
})

test('1. Valid test payment signature confirms pending booking and updates payment & vehicle', async () => {
  const orderId = 'order_test_legit_001'
  const paymentId = 'pay_test_legit_001'
  const { pool, state } = createMockDbPool({
    bookings: [{ id: 10, customer_id: 5, vehicle_id: 3, booking_reference: 'RR-10', total_amount: '2500.00', booking_status: 'pending' }],
    payments: [{ id: 100, booking_id: 10, customer_id: 5, amount: '2500.00', payment_status: 'initiated', gateway_transaction_id: orderId }],
    vehicles: [{ id: 3, availability_status: 'available' }]
  })

  const res = await paymentService.verifyPayment(
    5,
    {
      booking_id: 10,
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: sign(orderId, paymentId),
      payment_method: 'upi',
      amount: 250000,
      currency: 'INR'
    },
    pool
  )

  assert.equal(res.success, true)
  assert.equal(res.status, 'confirmed')
  assert.equal(state.committed, true)
  assert.equal(state.bookings[0].booking_status, 'confirmed')
  assert.equal(state.payments[0].payment_status, 'success')
  assert.equal(state.vehicles[0].availability_status, 'booked')
})

test('2. Invalid signature is rejected before DB transaction', async () => {
  const orderId = 'order_test_legit_002'
  const { pool, state } = createMockDbPool()

  await assert.rejects(
    () =>
      paymentService.verifyPayment(
        5,
        {
          booking_id: 10,
          razorpay_order_id: orderId,
          razorpay_payment_id: 'pay_123',
          razorpay_signature: 'a'.repeat(64)
        },
        pool
      ),
    /Invalid payment signature/
  )
  assert.equal(state.connectionRequested, false)
})

test('3. Missing signature is rejected before DB transaction', async () => {
  const { pool, state } = createMockDbPool()

  await assert.rejects(
    () =>
      paymentService.verifyPayment(
        5,
        {
          booking_id: 10,
          razorpay_order_id: 'order_test_123',
          razorpay_payment_id: 'pay_123'
        },
        pool
      ),
    /parameters missing/
  )
  assert.equal(state.connectionRequested, false)
})

test('4. Fake order_test_ ID cannot bypass verification (neither with dummy sig nor unrecorded order)', async () => {
  const fakeOrderId = 'order_test_attacker_bypass'
  const fakePayId = 'pay_attacker_001'
  const { pool, state } = createMockDbPool({
    bookings: [{ id: 10, customer_id: 5, vehicle_id: 3, booking_reference: 'RR-10', total_amount: '2500.00', booking_status: 'pending' }],
    payments: [{ id: 100, booking_id: 10, customer_id: 5, amount: '2500.00', payment_status: 'initiated', gateway_transaction_id: 'order_real_999' }]
  })

  // Dummy signature on order_test_ prefix
  await assert.rejects(
    () =>
      paymentService.verifyPayment(
        5,
        {
          booking_id: 10,
          razorpay_order_id: fakeOrderId,
          razorpay_payment_id: fakePayId,
          razorpay_signature: 'test_signature_verified'
        },
        pool
      ),
    /Invalid payment signature/
  )

  // Even with valid HMAC, unrecorded order_test_ ID is rejected
  await assert.rejects(
    () =>
      paymentService.verifyPayment(
        5,
        {
          booking_id: 10,
          razorpay_order_id: fakeOrderId,
          razorpay_payment_id: fakePayId,
          razorpay_signature: sign(fakeOrderId, fakePayId)
        },
        pool
      ),
    /Payment order not found/
  )
  assert.equal(state.rolledBack, true)
  assert.equal(state.bookings[0].booking_status, 'pending')
})

test('5. Wrong order ID is rejected and rolled back', async () => {
  const wrongOrderId = 'order_other_booking_999'
  const payId = 'pay_test_999'
  const { pool, state } = createMockDbPool({
    bookings: [{ id: 10, customer_id: 5, vehicle_id: 3, booking_reference: 'RR-10', total_amount: '2500.00', booking_status: 'pending' }],
    payments: [{ id: 100, booking_id: 10, customer_id: 5, amount: '2500.00', payment_status: 'initiated', gateway_transaction_id: 'order_expected_100' }]
  })

  await assert.rejects(
    () =>
      paymentService.verifyPayment(
        5,
        {
          booking_id: 10,
          razorpay_order_id: wrongOrderId,
          razorpay_payment_id: payId,
          razorpay_signature: sign(wrongOrderId, payId)
        },
        pool
      ),
    /Payment order not found/
  )
  assert.equal(state.rolledBack, true)
})

test('6. Wrong customer is rejected and rolled back', async () => {
  const orderId = 'order_test_006'
  const payId = 'pay_test_006'
  const { pool, state } = createMockDbPool({
    bookings: [{ id: 10, customer_id: 5, vehicle_id: 3, booking_reference: 'RR-10', total_amount: '2500.00', booking_status: 'pending' }],
    payments: [{ id: 100, booking_id: 10, customer_id: 5, amount: '2500.00', payment_status: 'initiated', gateway_transaction_id: orderId }]
  })

  await assert.rejects(
    () =>
      paymentService.verifyPayment(
        99, // attacker customer ID
        {
          booking_id: 10,
          razorpay_order_id: orderId,
          razorpay_payment_id: payId,
          razorpay_signature: sign(orderId, payId)
        },
        pool
      ),
    /Booking not found or not owned by you/
  )
  assert.equal(state.rolledBack, true)
})

test('7. Wrong amount or currency is rejected and rolled back', async () => {
  const orderId = 'order_test_007'
  const payId = 'pay_test_007'
  const { pool, state } = createMockDbPool({
    bookings: [{ id: 10, customer_id: 5, vehicle_id: 3, booking_reference: 'RR-10', total_amount: '2500.00', booking_status: 'pending' }],
    payments: [{ id: 100, booking_id: 10, customer_id: 5, amount: '100.00', payment_status: 'initiated', gateway_transaction_id: orderId }]
  })

  await assert.rejects(
    () =>
      paymentService.verifyPayment(
        5,
        {
          booking_id: 10,
          razorpay_order_id: orderId,
          razorpay_payment_id: payId,
          razorpay_signature: sign(orderId, payId)
        },
        pool
      ),
    /Payment amount mismatch/
  )
  assert.equal(state.rolledBack, true)

  // Also test mismatched payload amount in paise
  const { pool: pool2 } = createMockDbPool({
    bookings: [{ id: 10, customer_id: 5, vehicle_id: 3, booking_reference: 'RR-10', total_amount: '2500.00', booking_status: 'pending' }],
    payments: [{ id: 100, booking_id: 10, customer_id: 5, amount: '2500.00', payment_status: 'initiated', gateway_transaction_id: orderId }]
  })

  await assert.rejects(
    () =>
      paymentService.verifyPayment(
        5,
        {
          booking_id: 10,
          razorpay_order_id: orderId,
          razorpay_payment_id: payId,
          razorpay_signature: sign(orderId, payId),
          amount: 100
        },
        pool2
      ),
    /Payment amount mismatch/
  )
})

test('8. Cancelled booking is rejected and rolled back', async () => {
  const orderId = 'order_test_008'
  const payId = 'pay_test_008'
  const { pool, state } = createMockDbPool({
    bookings: [{ id: 10, customer_id: 5, vehicle_id: 3, booking_reference: 'RR-10', total_amount: '2500.00', booking_status: 'cancelled' }],
    payments: [{ id: 100, booking_id: 10, customer_id: 5, amount: '2500.00', payment_status: 'initiated', gateway_transaction_id: orderId }]
  })

  await assert.rejects(
    () =>
      paymentService.verifyPayment(
        5,
        {
          booking_id: 10,
          razorpay_order_id: orderId,
          razorpay_payment_id: payId,
          razorpay_signature: sign(orderId, payId)
        },
        pool
      ),
    /cancelled booking/
  )
  assert.equal(state.rolledBack, true)
})

test('9. Duplicate verification on already confirmed booking returns idempotent alreadyConfirmed', async () => {
  const orderId = 'order_test_009'
  const payId = 'pay_test_009'
  const { pool, state } = createMockDbPool({
    bookings: [{ id: 10, customer_id: 5, vehicle_id: 3, booking_reference: 'RR-10', total_amount: '2500.00', booking_status: 'confirmed' }],
    payments: [{ id: 100, booking_id: 10, customer_id: 5, amount: '2500.00', payment_status: 'success', gateway_transaction_id: payId }]
  })

  const res = await paymentService.verifyPayment(
    5,
    {
      booking_id: 10,
      razorpay_order_id: orderId,
      razorpay_payment_id: payId,
      razorpay_signature: sign(orderId, payId)
    },
    pool
  )

  assert.equal(res.success, true)
  assert.equal(res.alreadyConfirmed, true)
  assert.equal(state.committed, true)
})

test('10. Already-paid booking with a second initiated order does not double-confirm or overwrite', async () => {
  const orderId2 = 'order_test_010_second'
  const payId2 = 'pay_test_010_second'
  const { pool, state } = createMockDbPool({
    bookings: [{ id: 10, customer_id: 5, vehicle_id: 3, booking_reference: 'RR-10', total_amount: '2500.00', booking_status: 'pending' }],
    payments: [
      { id: 100, booking_id: 10, customer_id: 5, amount: '2500.00', payment_status: 'success', gateway_transaction_id: 'pay_first' },
      { id: 101, booking_id: 10, customer_id: 5, amount: '2500.00', payment_status: 'initiated', gateway_transaction_id: orderId2 }
    ]
  })

  const res = await paymentService.verifyPayment(
    5,
    {
      booking_id: 10,
      razorpay_order_id: orderId2,
      razorpay_payment_id: payId2,
      razorpay_signature: sign(orderId2, payId2)
    },
    pool
  )

  assert.equal(res.success, true)
  assert.equal(res.alreadyConfirmed, true)
  assert.equal(state.payments[1].payment_status, 'initiated')
  assert.equal(state.committed, true)
})

test('11. Razorpay API capture check succeeds when payment is captured with matching order, amount, and INR', async () => {
  const orderId = 'order_rzp_live_011'
  const payId = 'pay_rzp_live_011'
  const { pool, state } = createMockDbPool({
    bookings: [{ id: 10, customer_id: 5, vehicle_id: 3, booking_reference: 'RR-10', total_amount: '2500.00', booking_status: 'pending' }],
    payments: [{ id: 100, booking_id: 10, customer_id: 5, amount: '2500.00', payment_status: 'initiated', gateway_transaction_id: orderId }],
    vehicles: [{ id: 3, availability_status: 'available' }]
  })
  const mockRazorpay = {
    payments: {
      async fetch(id) {
        assert.equal(id, payId)
        return { id, order_id: orderId, amount: 250000, currency: 'INR', status: 'captured' }
      }
    }
  }

  const res = await paymentService.verifyPayment(
    5,
    { booking_id: 10, razorpay_order_id: orderId, razorpay_payment_id: payId, razorpay_signature: sign(orderId, payId) },
    pool,
    mockRazorpay
  )

  assert.equal(res.success, true)
  assert.equal(res.status, 'confirmed')
  assert.equal(state.committed, true)
  assert.equal(state.bookings[0].booking_status, 'confirmed')
})

test('12. Razorpay API capture check rejects failed or uncaptured payment and rolls back', async () => {
  const orderId = 'order_rzp_live_012'
  const payId = 'pay_rzp_live_012'
  const { pool, state } = createMockDbPool({
    bookings: [{ id: 10, customer_id: 5, vehicle_id: 3, booking_reference: 'RR-10', total_amount: '2500.00', booking_status: 'pending' }],
    payments: [{ id: 100, booking_id: 10, customer_id: 5, amount: '2500.00', payment_status: 'initiated', gateway_transaction_id: orderId }],
    vehicles: [{ id: 3, availability_status: 'available' }]
  })
  const mockRazorpay = {
    payments: {
      async fetch() {
        return { id: payId, order_id: orderId, amount: 250000, currency: 'INR', status: 'failed' }
      }
    }
  }

  await assert.rejects(
    () =>
      paymentService.verifyPayment(
        5,
        { booking_id: 10, razorpay_order_id: orderId, razorpay_payment_id: payId, razorpay_signature: sign(orderId, payId) },
        pool,
        mockRazorpay
      ),
    /not captured/
  )
  assert.equal(state.rolledBack, true)
  assert.equal(state.bookings[0].booking_status, 'pending')
})

test('13. Razorpay API capture check captures authorized payment before confirming booking', async () => {
  const orderId = 'order_rzp_live_013'
  const payId = 'pay_rzp_live_013'
  let captureCalled = false
  const { pool, state } = createMockDbPool({
    bookings: [{ id: 10, customer_id: 5, vehicle_id: 3, booking_reference: 'RR-10', total_amount: '2500.00', booking_status: 'pending' }],
    payments: [{ id: 100, booking_id: 10, customer_id: 5, amount: '2500.00', payment_status: 'initiated', gateway_transaction_id: orderId }],
    vehicles: [{ id: 3, availability_status: 'available' }]
  })
  const mockRazorpay = {
    payments: {
      async fetch() {
        return { id: payId, order_id: orderId, amount: 250000, currency: 'INR', status: 'authorized' }
      },
      async capture(id, amt, curr) {
        captureCalled = true
        assert.equal(id, payId)
        assert.equal(amt, 250000)
        assert.equal(curr, 'INR')
        return { id, status: 'captured' }
      }
    }
  }

  const res = await paymentService.verifyPayment(
    5,
    { booking_id: 10, razorpay_order_id: orderId, razorpay_payment_id: payId, razorpay_signature: sign(orderId, payId) },
    pool,
    mockRazorpay
  )

  assert.equal(captureCalled, true)
  assert.equal(res.status, 'confirmed')
  assert.equal(state.committed, true)
})

test('14. Razorpay API capture check rejects gateway order_id or amount mismatch', async () => {
  const orderId = 'order_rzp_live_014'
  const payId = 'pay_rzp_live_014'
  const { pool, state } = createMockDbPool({
    bookings: [{ id: 10, customer_id: 5, vehicle_id: 3, booking_reference: 'RR-10', total_amount: '2500.00', booking_status: 'pending' }],
    payments: [{ id: 100, booking_id: 10, customer_id: 5, amount: '2500.00', payment_status: 'initiated', gateway_transaction_id: orderId }]
  })
  const mockRazorpay = {
    payments: {
      async fetch() {
        return { id: payId, order_id: 'order_different', amount: 250000, currency: 'INR', status: 'captured' }
      }
    }
  }

  await assert.rejects(
    () =>
      paymentService.verifyPayment(
        5,
        { booking_id: 10, razorpay_order_id: orderId, razorpay_payment_id: payId, razorpay_signature: sign(orderId, payId) },
        pool,
        mockRazorpay
      ),
    /does not match the expected order ID/
  )
  assert.equal(state.rolledBack, true)
})
