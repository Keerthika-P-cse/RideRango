import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { bookingService, calculateFullDemoRefund } from '../src/services/bookingService.js'
import { isDeadlockOrLockError, withDeadlockRetry } from '../src/utils/dbTransactionHelper.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..', '..')

function createMockCancelPool(initialState = {}, options = {}) {
  const state = {
    bookings: initialState.bookings ? initialState.bookings.map(b => ({ ...b })) : [],
    payments: initialState.payments ? initialState.payments.map(p => ({ ...p })) : [],
    vehicles: initialState.vehicles ? initialState.vehicles.map(v => ({ ...v })) : [],
    paymentStatusHistory: [],
    committed: false,
    rolledBack: false,
    released: false,
    nextPaymentId: initialState.nextPaymentId || 500
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
        return [state.bookings.filter(b => b.id === id && b.customer_id === customerId).map(b => ({ vehicle_id: b.vehicle_id }))]
      }

      if (normalized.startsWith('SELECT id, availability_status FROM vehicles WHERE id = ? FOR UPDATE')) {
        const [vehicleId] = params
        state.lockOrder = state.lockOrder || []
        state.lockOrder.push('vehicles')
        return [state.vehicles.filter(v => v.id === vehicleId).map(v => ({ id: v.id, availability_status: v.availability_status }))]
      }

      if (normalized.startsWith('SELECT * FROM bookings WHERE id = ? AND customer_id = ?')) {
        const [id, customerId] = params
        state.lockOrder = state.lockOrder || []
        state.lockOrder.push('bookings')
        return [state.bookings.filter(b => b.id === id && b.customer_id === customerId)]
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
        const [vehicleId, excludeBookingId] = params
        const rows = state.bookings
          .filter(b => b.vehicle_id === vehicleId && ['confirmed', 'active'].includes(b.booking_status) && b.id !== excludeBookingId)
          .slice(0, 1)
          .map(b => ({ id: b.id }))
        return [rows]
      }

      if (normalized.startsWith("UPDATE vehicles SET availability_status = 'available' WHERE id = ? AND availability_status = 'booked'")) {
        const [vehicleId] = params
        const v = state.vehicles.find(veh => veh.id === vehicleId && veh.availability_status === 'booked')
        if (v) {
          v.availability_status = 'available'
        }
        return [{ affectedRows: v ? 1 : 0 }]
      }

      if (normalized.startsWith('SELECT id, amount, payment_method, transaction_reference FROM payments')) {
        const [bookingId, customerId] = params
        const rows = state.payments
          .filter(
            p =>
              p.booking_id === bookingId &&
              p.customer_id === customerId &&
              p.payment_status === 'success' &&
              p.payment_type !== 'refund'
          )
          .sort((a, b) => b.id - a.id)
          .slice(0, 1)
        return [rows]
      }

      if (normalized.startsWith('SELECT id, transaction_reference, payment_status FROM payments')) {
        const [bookingId] = params
        const rows = state.payments
          .filter(
            p =>
              p.booking_id === bookingId &&
              p.payment_type === 'refund' &&
              ['initiated', 'refunded'].includes(p.payment_status)
          )
          .slice(0, 1)
        return [rows]
      }

      if (normalized.startsWith('INSERT INTO payments')) {
        if (options.failOnRefundInsert) {
          throw new Error('Simulated DB failure during refund insert')
        }
        const [txnRef, bookingId, customerId, amount, method, gatewayRef, notes] = params
        const newId = state.nextPaymentId++
        const newRow = {
          id: newId,
          transaction_reference: txnRef,
          booking_id: bookingId,
          customer_id: customerId,
          amount,
          payment_type: 'refund',
          payment_method: method,
          payment_status: 'initiated',
          gateway_transaction_id: gatewayRef,
          payment_notes: notes,
          paid_at: null
        }
        state.payments.push(newRow)
        state.paymentStatusHistory.push('initiated')
        return [{ insertId: newId }]
      }

      if (normalized.startsWith("UPDATE payments SET payment_status = 'refunded'")) {
        if (options.failOnRefundComplete) {
          throw new Error('Simulated DB failure during refund completion')
        }
        const [notes, refundId] = params
        const row = state.payments.find(p => p.id === refundId)
        if (row) {
          row.payment_status = 'refunded'
          row.payment_notes = notes
          row.paid_at = new Date().toISOString()
          state.paymentStatusHistory.push('refunded')
        }
        return [{ affectedRows: row ? 1 : 0 }]
      }

      throw new Error(`Unexpected SQL in mock cancel pool: ${normalized}`)
    }
  }

  return {
    state,
    pool: {
      async getConnection() {
        return connection
      }
    }
  }
}

const futureStartDate = () => new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

test('1. calculateFullDemoRefund returns exact 100% of paid amount with no deductions', () => {
  assert.equal(calculateFullDemoRefund('5499.00'), 5499)
  assert.equal(calculateFullDemoRefund(2899.5), 2899.5)
  assert.equal(calculateFullDemoRefund(0), 0)
  assert.equal(calculateFullDemoRefund(-100), 0)
  assert.equal(calculateFullDemoRefund(null), 0)
  assert.equal(calculateFullDemoRefund('invalid'), 0)
})

test('2. Eligible paid booking cancellation issues 100% DEMO refund, transitions initiated -> refunded, cancels booking, and frees vehicle', async () => {
  const { pool, state } = createMockCancelPool({
    bookings: [
      { id: 11, customer_id: 7, vehicle_id: 1, booking_status: 'confirmed', total_amount: '5499.00', start_date: futureStartDate() }
    ],
    payments: [
      { id: 88, booking_id: 11, customer_id: 7, amount: '5499.00', payment_type: 'rental_fee', payment_method: 'upi', payment_status: 'success' }
    ],
    vehicles: [
      { id: 1, availability_status: 'booked' }
    ]
  })

  const res = await bookingService.cancelBooking(11, 7, 'Plans changed', pool)

  assert.equal(state.committed, true)
  assert.equal(state.rolledBack, false)
  assert.equal(state.released, true)

  assert.equal(res.booking_status, 'cancelled')
  assert.equal(res.refund_initiated, true)
  assert.equal(res.refund_status, 'refunded')
  assert.equal(res.refund_amount, 5499)
  assert.equal(res.is_demo_refund, true)
  assert.match(res.refund_reference, /^DEMO-REF-/)

  assert.deepEqual(state.paymentStatusHistory, ['initiated', 'refunded'])
  assert.equal(state.bookings[0].booking_status, 'cancelled')
  assert.equal(state.vehicles[0].availability_status, 'available')

  const refundRow = state.payments.find(p => p.payment_type === 'refund')
  assert.ok(refundRow)
  assert.equal(refundRow.amount, 5499)
  assert.equal(refundRow.gateway_transaction_id, 'DEMO_REFUND_PAY_88')
  assert.match(refundRow.payment_notes, /DEMO:/)
})

test('3. Unpaid booking cancellation cancels booking and restores vehicle without creating a refund', async () => {
  const { pool, state } = createMockCancelPool({
    bookings: [
      { id: 12, customer_id: 7, vehicle_id: 3, booking_status: 'pending', total_amount: '3199.00', start_date: futureStartDate() }
    ],
    payments: [],
    vehicles: [
      { id: 3, availability_status: 'booked' }
    ]
  })

  const res = await bookingService.cancelBooking(12, 7, 'Unpaid cancel', pool)

  assert.equal(state.committed, true)
  assert.equal(res.booking_status, 'cancelled')
  assert.equal(res.refund_initiated, false)
  assert.equal(res.refund_status, null)
  assert.equal(res.refund_amount, 0)
  assert.equal(res.is_demo_refund, false)
  assert.equal(state.payments.length, 0)
  assert.equal(state.vehicles[0].availability_status, 'available')
})

test('4. Duplicate cancellation is rejected and rolled back', async () => {
  const { pool, state } = createMockCancelPool({
    bookings: [
      { id: 13, customer_id: 7, vehicle_id: 1, booking_status: 'cancelled', total_amount: '2499.00', start_date: futureStartDate() }
    ]
  })

  await assert.rejects(
    () => bookingService.cancelBooking(13, 7, 'Try again', pool),
    /already been cancelled/
  )
  assert.equal(state.rolledBack, true)
  assert.equal(state.committed, false)
  assert.equal(state.released, true)
})

test('5. Duplicate refund prevention blocks creating a second refund for the same booking/payment', async () => {
  const { pool, state } = createMockCancelPool({
    bookings: [
      { id: 14, customer_id: 7, vehicle_id: 1, booking_status: 'confirmed', total_amount: '2499.00', start_date: futureStartDate() }
    ],
    payments: [
      { id: 90, booking_id: 14, customer_id: 7, amount: '2499.00', payment_type: 'rental_fee', payment_method: 'upi', payment_status: 'success' },
      { id: 91, booking_id: 14, customer_id: 7, amount: '2499.00', payment_type: 'refund', payment_method: 'upi', payment_status: 'refunded' }
    ],
    vehicles: [
      { id: 1, availability_status: 'booked' }
    ]
  })

  await assert.rejects(
    () => bookingService.cancelBooking(14, 7, 'Duplicate refund attempt', pool),
    /refund has already been initiated or completed/
  )
  assert.equal(state.rolledBack, true)
  assert.equal(state.committed, false)
  assert.equal(state.payments.filter(p => p.payment_type === 'refund').length, 1)
})

test('6. Customer cannot cancel another customer booking', async () => {
  const { pool, state } = createMockCancelPool({
    bookings: [
      { id: 15, customer_id: 99, vehicle_id: 1, booking_status: 'confirmed', total_amount: '2499.00', start_date: futureStartDate() }
    ]
  })

  await assert.rejects(
    () => bookingService.cancelBooking(15, 7, 'Unauthorized cancel', pool),
    /not found or not owned by you/i
  )
  assert.equal(state.rolledBack, true)
  assert.equal(state.committed, false)
})

test('7. Database transaction rolls back on failure during simulated refund completion', async () => {
  const { pool, state } = createMockCancelPool(
    {
      bookings: [
        { id: 16, customer_id: 7, vehicle_id: 1, booking_status: 'confirmed', total_amount: '2499.00', start_date: futureStartDate() }
      ],
      payments: [
        { id: 92, booking_id: 16, customer_id: 7, amount: '2499.00', payment_type: 'rental_fee', payment_method: 'upi', payment_status: 'success' }
      ],
      vehicles: [
        { id: 1, availability_status: 'booked' }
      ]
    },
    { failOnRefundComplete: true }
  )

  await assert.rejects(
    () => bookingService.cancelBooking(16, 7, 'Rollback test', pool),
    /Simulated DB failure during refund completion/
  )
  assert.equal(state.rolledBack, true)
  assert.equal(state.committed, false)
  assert.equal(state.released, true)
})

test('8. Customer and admin UI/controller surfaces clearly display DEMO refund status and amount', () => {
  const myBookings = fs.readFileSync(path.join(repoRoot, 'frontend/src/pages/customer/MyBookingsPage.jsx'), 'utf8')
  const adminBookings = fs.readFileSync(path.join(repoRoot, 'frontend/src/pages/admin/AdminBookingsPage.jsx'), 'utf8')
  const adminPayments = fs.readFileSync(path.join(repoRoot, 'frontend/src/pages/admin/AdminPaymentsPage.jsx'), 'utf8')
  const adminController = fs.readFileSync(path.join(repoRoot, 'backend/src/controllers/adminController.js'), 'utf8')

  assert.match(myBookings, /DEMO Refund/)
  assert.match(myBookings, /refund_status/)
  assert.match(myBookings, /refund_amount/)
  assert.match(myBookings, /no real money transferred/i)

  assert.match(adminBookings, /DEMO Refund/)
  assert.match(adminBookings, /refund_status/)
  assert.match(adminBookings, /refund_amount/)

  assert.match(adminPayments, /DEMO REFUND/)
  assert.match(adminPayments, /Simulated/)

  assert.match(adminController, /refund_status/)
  assert.match(adminController, /refund_amount/)
  assert.match(adminController, /refund_reference/)
})

test('9. Cancelling a booking does not overwrite maintenance vehicle status and locks vehicles before bookings', async () => {
  const { pool, state } = createMockCancelPool({
    bookings: [
      { id: 21, customer_id: 7, vehicle_id: 4, booking_status: 'confirmed', total_amount: '999.00', start_date: futureStartDate() }
    ],
    payments: [
      { id: 101, booking_id: 21, customer_id: 7, amount: '999.00', payment_type: 'rental_fee', payment_method: 'upi', payment_status: 'success' }
    ],
    vehicles: [
      { id: 4, availability_status: 'maintenance' }
    ]
  })

  const res = await bookingService.cancelBooking(21, 7, 'Cancel during maintenance', pool)
  assert.equal(state.committed, true)
  assert.equal(res.booking_status, 'cancelled')
  assert.equal(res.refund_amount, 999)
  assert.equal(state.vehicles[0].availability_status, 'maintenance')
  assert.deepEqual(state.lockOrder, ['vehicles', 'bookings'])
})

test('10. Cancelling a booking does not overwrite decommissioned vehicle status', async () => {
  const { pool, state } = createMockCancelPool({
    bookings: [
      { id: 22, customer_id: 7, vehicle_id: 5, booking_status: 'pending', total_amount: '699.00', start_date: futureStartDate() }
    ],
    payments: [],
    vehicles: [
      { id: 5, availability_status: 'decommissioned' }
    ]
  })

  const res = await bookingService.cancelBooking(22, 7, 'Cancel decommissioned', pool)
  assert.equal(state.committed, true)
  assert.equal(res.booking_status, 'cancelled')
  assert.equal(state.vehicles[0].availability_status, 'decommissioned')
})

test('11. Another confirmed booking prevents vehicle availability restoration', async () => {
  const { pool, state } = createMockCancelPool({
    bookings: [
      { id: 23, customer_id: 7, vehicle_id: 6, booking_status: 'confirmed', total_amount: '499.00', start_date: futureStartDate() },
      { id: 24, customer_id: 8, vehicle_id: 6, booking_status: 'confirmed', total_amount: '499.00', start_date: futureStartDate() }
    ],
    payments: [
      { id: 102, booking_id: 23, customer_id: 7, amount: '499.00', payment_type: 'rental_fee', payment_method: 'upi', payment_status: 'success' }
    ],
    vehicles: [
      { id: 6, availability_status: 'booked' }
    ]
  })

  const res = await bookingService.cancelBooking(23, 7, 'Other confirmed exists', pool)
  assert.equal(state.committed, true)
  assert.equal(res.booking_status, 'cancelled')
  assert.equal(res.refund_amount, 499)
  assert.equal(state.vehicles[0].availability_status, 'booked')
})

test('12. Another active booking prevents vehicle availability restoration', async () => {
  const { pool, state } = createMockCancelPool({
    bookings: [
      { id: 25, customer_id: 7, vehicle_id: 7, booking_status: 'confirmed', total_amount: '1899.00', start_date: futureStartDate() },
      { id: 26, customer_id: 9, vehicle_id: 7, booking_status: 'active', total_amount: '1899.00', start_date: futureStartDate() }
    ],
    payments: [
      { id: 103, booking_id: 25, customer_id: 7, amount: '1899.00', payment_type: 'rental_fee', payment_method: 'upi', payment_status: 'success' }
    ],
    vehicles: [
      { id: 7, availability_status: 'booked' }
    ]
  })

  const res = await bookingService.cancelBooking(25, 7, 'Other active exists', pool)
  assert.equal(state.committed, true)
  assert.equal(res.booking_status, 'cancelled')
  assert.equal(res.refund_amount, 1899)
  assert.equal(state.vehicles[0].availability_status, 'booked')
})

test('13. Deadlock error on first attempt retries cleanly and succeeds on retry', async () => {
  let attempts = 0
  let rollbacks = 0
  const base = createMockCancelPool({
    bookings: [
      { id: 30, customer_id: 7, vehicle_id: 1, booking_status: 'confirmed', total_amount: '2499.00', start_date: futureStartDate() }
    ],
    payments: [
      { id: 120, booking_id: 30, customer_id: 7, amount: '2499.00', payment_type: 'rental_fee', payment_method: 'upi', payment_status: 'success' }
    ],
    vehicles: [
      { id: 1, availability_status: 'booked' }
    ]
  })

  const flakyPool = {
    async getConnection() {
      attempts++
      const realConn = await base.pool.getConnection()
      if (attempts === 1) {
        return {
          async beginTransaction() {},
          async query() {
            const err = new Error('Deadlock found when trying to get lock; try restarting transaction')
            err.code = 'ER_LOCK_DEADLOCK'
            err.errno = 1213
            throw err
          },
          async rollback() {
            rollbacks++
          },
          release() {}
        }
      }
      return realConn
    }
  }

  const res = await bookingService.cancelBooking(30, 7, 'Retry after deadlock', flakyPool)
  assert.equal(attempts, 2)
  assert.equal(rollbacks, 1)
  assert.equal(res.booking_status, 'cancelled')
  assert.equal(res.refund_amount, 2499)
  assert.equal(base.state.committed, true)
})

test('14. Persistent deadlock exhausts retries, rolls back, and returns 409 conflict error', async () => {
  let attempts = 0
  let rollbacks = 0
  const deadlockPool = {
    async getConnection() {
      attempts++
      return {
        async beginTransaction() {},
        async query() {
          const err = new Error('Deadlock found when trying to get lock')
          err.code = 'ER_LOCK_DEADLOCK'
          err.errno = 1213
          throw err
        },
        async rollback() {
          rollbacks++
        },
        release() {}
      }
    }
  }

  await assert.rejects(
    () => bookingService.cancelBooking(31, 7, 'Persistent deadlock', deadlockPool),
    (err) => {
      assert.equal(err.statusCode, 409)
      assert.equal(err.code, 'ER_LOCK_DEADLOCK')
      assert.match(err.message, /Concurrent booking\/payment update conflict/)
      return true
    }
  )
  assert.equal(attempts, 3)
  assert.equal(rollbacks, 3)
  assert.equal(isDeadlockOrLockError({ errno: 1213 }), true)
  assert.equal(isDeadlockOrLockError({ errno: 9007 }), true)
  assert.equal(isDeadlockOrLockError(new Error('Normal validation error')), false)
  assert.equal(typeof withDeadlockRetry, 'function')
})
