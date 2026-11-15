import test from 'node:test'
import assert from 'node:assert/strict'
import { bookingService } from '../src/services/bookingService.js'

/**
 * Creates an in-memory mock pool with transaction support, row locking emulation,
 * and state tracking for bookings, vehicles, and payments.
 */
function createMockPool(initialState = {}) {
  const state = {
    bookings: initialState.bookings ? initialState.bookings.map(b => ({ ...b })) : [],
    vehicles: initialState.vehicles ? initialState.vehicles.map(v => ({ ...v })) : [],
    payments: initialState.payments ? initialState.payments.map(p => ({ ...p })) : [],
    committed: false,
    rolledBack: false,
    released: false,
    lockOrder: []
  }

  const connection = {
    async beginTransaction() {
      state.committed = false
      state.rolledBack = false
    },
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

      // 1. SELECT id, vehicle_id FROM bookings WHERE id = ?
      if (normalized.startsWith('SELECT id, vehicle_id FROM bookings WHERE id = ?')) {
        const [id] = params
        const row = state.bookings.find(b => b.id === Number(id))
        return [row ? [{ id: row.id, vehicle_id: row.vehicle_id }] : []]
      }

      // 2. Lock vehicle
      if (normalized.startsWith('SELECT id, make, model, registration_number, availability_status, is_active FROM vehicles WHERE id = ? FOR UPDATE')) {
        const [vehicleId] = params
        state.lockOrder.push('vehicles')
        const row = state.vehicles.find(v => v.id === Number(vehicleId))
        return [row ? [{ ...row }] : []]
      }

      // 3. Lock booking
      if (normalized.startsWith('SELECT id, booking_reference, customer_id, vehicle_id, start_date, end_date, booking_status, cancellation_reason, approved_by_staff_id, total_amount FROM bookings WHERE id = ? FOR UPDATE')) {
        const [id] = params
        state.lockOrder.push('bookings')
        const row = state.bookings.find(b => b.id === Number(id))
        return [row ? [{ ...row }] : []]
      }

      // 4. Overlap conflict check for confirmation
      if (normalized.startsWith('SELECT id, booking_reference, booking_status, start_date, end_date FROM bookings WHERE vehicle_id = ? AND booking_status IN (\'confirmed\', \'active\') AND id != ? AND start_date < ? AND end_date > ? LIMIT 1 FOR UPDATE')) {
        const [vehicleId, excludeId, newEnd, newStart] = params
        const newStartMs = new Date(newStart).getTime()
        const newEndMs = new Date(newEnd).getTime()

        const conflict = state.bookings.find(b => {
          if (b.vehicle_id !== Number(vehicleId) || b.id === Number(excludeId)) return false
          if (!['confirmed', 'active'].includes(b.booking_status)) return false
          const bStartMs = new Date(b.start_date).getTime()
          const bEndMs = new Date(b.end_date).getTime()
          return bStartMs < newEndMs && bEndMs > newStartMs
        })

        return [conflict ? [{ id: conflict.id, booking_reference: conflict.booking_reference, booking_status: conflict.booking_status }] : []]
      }

      // 5. Active rental collision check for handover
      if (normalized.startsWith('SELECT id, booking_reference FROM bookings WHERE vehicle_id = ? AND booking_status = \'active\' AND id != ? LIMIT 1 FOR UPDATE')) {
        const [vehicleId, excludeId] = params
        const active = state.bookings.find(b => b.vehicle_id === Number(vehicleId) && b.booking_status === 'active' && b.id !== Number(excludeId))
        return [active ? [{ id: active.id, booking_reference: active.booking_reference }] : []]
      }

      // 6. Remaining other confirmed/active bookings check
      if (normalized.startsWith('SELECT id, booking_reference, booking_status, start_date, end_date FROM bookings WHERE vehicle_id = ? AND booking_status IN (\'confirmed\', \'active\') AND id != ? ORDER BY start_date ASC FOR UPDATE')) {
        const [vehicleId, excludeId] = params
        const rows = state.bookings.filter(b => b.vehicle_id === Number(vehicleId) && ['confirmed', 'active'].includes(b.booking_status) && b.id !== Number(excludeId))
        return [rows.map(r => ({ ...r }))]
      }

      // 7. Update booking
      if (normalized.includes("UPDATE bookings SET booking_status = 'confirmed'")) {
        const [staffId, id] = params
        const row = state.bookings.find(b => b.id === Number(id))
        if (row) {
          row.booking_status = 'confirmed'
          row.approved_by_staff_id = staffId || row.approved_by_staff_id
        }
        return [{ affectedRows: row ? 1 : 0 }]
      }

      if (normalized.includes("UPDATE bookings SET booking_status = 'active'")) {
        const [staffId, id] = params
        const row = state.bookings.find(b => b.id === Number(id))
        if (row) {
          row.booking_status = 'active'
          row.approved_by_staff_id = staffId || row.approved_by_staff_id
        }
        return [{ affectedRows: row ? 1 : 0 }]
      }

      if (normalized.includes("UPDATE bookings SET booking_status = 'completed'")) {
        const [id] = params
        const row = state.bookings.find(b => b.id === Number(id))
        if (row) {
          row.booking_status = 'completed'
        }
        return [{ affectedRows: row ? 1 : 0 }]
      }

      if (normalized.includes("UPDATE bookings SET booking_status = 'cancelled'")) {
        const [reason, id] = params
        const row = state.bookings.find(b => b.id === Number(id))
        if (row) {
          row.booking_status = 'cancelled'
          row.cancellation_reason = reason || row.cancellation_reason
        }
        return [{ affectedRows: row ? 1 : 0 }]
      }

      // 8. Update vehicle availability
      if (normalized.includes("UPDATE vehicles SET availability_status = 'booked'")) {
        const [vehicleId] = params
        const v = state.vehicles.find(veh => veh.id === Number(vehicleId))
        if (v) v.availability_status = 'booked'
        return [{ affectedRows: v ? 1 : 0 }]
      }

      if (normalized.includes("UPDATE vehicles SET availability_status = 'rented'")) {
        const [vehicleId] = params
        const v = state.vehicles.find(veh => veh.id === Number(vehicleId))
        if (v) v.availability_status = 'rented'
        return [{ affectedRows: v ? 1 : 0 }]
      }

      if (normalized.includes("UPDATE vehicles SET availability_status = 'available'")) {
        const [vehicleId] = params
        const v = state.vehicles.find(veh => veh.id === Number(vehicleId))
        if (v) v.availability_status = 'available'
        return [{ affectedRows: v ? 1 : 0 }]
      }

      return [[]]
    }
  }

  const pool = {
    async getConnection() {
      return connection
    }
  }

  return { pool, state }
}

test('1. Normal Lifecycle Flow: pending -> confirmed -> active -> completed updates vehicle availability cleanly', async () => {
  const { pool, state } = createMockPool({
    vehicles: [{ id: 1, make: 'Hyundai', model: 'Creta', availability_status: 'available', is_active: 1 }],
    bookings: [{
      id: 10,
      booking_reference: 'RR-BK-TEST-10',
      vehicle_id: 1,
      customer_id: 101,
      start_date: '2026-11-20T10:00:00.000Z',
      end_date: '2026-11-23T10:00:00.000Z',
      booking_status: 'pending'
    }]
  })

  // 1. Pending -> Confirmed
  const res1 = await bookingService.updateBookingStatusByAdmin(10, 'confirmed', { staffId: 5 }, pool)
  assert.equal(res1.data.status, 'confirmed')
  assert.equal(state.bookings[0].booking_status, 'confirmed')
  assert.equal(state.vehicles[0].availability_status, 'booked')
  assert.equal(state.committed, true)

  // 2. Confirmed -> Active (Handover)
  const res2 = await bookingService.updateBookingStatusByAdmin(10, 'active', { staffId: 5 }, pool)
  assert.equal(res2.data.status, 'active')
  assert.equal(state.bookings[0].booking_status, 'active')
  assert.equal(state.vehicles[0].availability_status, 'rented')

  // 3. Active -> Completed (Return & closure)
  const res3 = await bookingService.updateBookingStatusByAdmin(10, 'completed', { staffId: 5 }, pool)
  assert.equal(res3.data.status, 'completed')
  assert.equal(state.bookings[0].booking_status, 'completed')
  assert.equal(state.vehicles[0].availability_status, 'available')
  assert.deepEqual(state.lockOrder.slice(0, 4), ['vehicles', 'bookings', 'vehicles', 'bookings'])
})

test('2. Pending -> Cancelled transition cancels booking and keeps vehicle available', async () => {
  const { pool, state } = createMockPool({
    vehicles: [{ id: 1, make: 'Tata', model: 'Nexon', availability_status: 'available', is_active: 1 }],
    bookings: [{
      id: 11,
      booking_reference: 'RR-BK-TEST-11',
      vehicle_id: 1,
      customer_id: 102,
      start_date: '2026-11-20T10:00:00.000Z',
      end_date: '2026-11-22T10:00:00.000Z',
      booking_status: 'pending'
    }]
  })

  const res = await bookingService.updateBookingStatusByAdmin(11, 'cancelled', { reason: 'Customer changed plans' }, pool)
  assert.equal(res.data.status, 'cancelled')
  assert.equal(state.bookings[0].booking_status, 'cancelled')
  assert.equal(state.bookings[0].cancellation_reason, 'Customer changed plans')
  assert.equal(state.vehicles[0].availability_status, 'available')
})

test('3. Confirmed -> Cancelled restores vehicle to available when no other bookings exist', async () => {
  const { pool, state } = createMockPool({
    vehicles: [{ id: 1, make: 'Mahindra', model: 'Thar', availability_status: 'booked', is_active: 1 }],
    bookings: [{
      id: 12,
      booking_reference: 'RR-BK-TEST-12',
      vehicle_id: 1,
      customer_id: 103,
      start_date: '2026-11-25T10:00:00.000Z',
      end_date: '2026-11-28T10:00:00.000Z',
      booking_status: 'confirmed'
    }]
  })

  const res = await bookingService.updateBookingStatusByAdmin(12, 'cancelled', {}, pool)
  assert.equal(res.data.status, 'cancelled')
  assert.equal(state.vehicles[0].availability_status, 'available')
})

test('4. Terminal Protection: Attempted cancelled -> confirmed is rejected', async () => {
  const { pool, state } = createMockPool({
    vehicles: [{ id: 1, availability_status: 'available', is_active: 1 }],
    bookings: [{ id: 13, vehicle_id: 1, booking_status: 'cancelled' }]
  })

  await assert.rejects(
    async () => {
      await bookingService.updateBookingStatusByAdmin(13, 'confirmed', {}, pool)
    },
    (err) => {
      assert.equal(err.statusCode, 400)
      assert.match(err.message, /Cancelled bookings are terminal and cannot be reopened/i)
      return true
    }
  )
  assert.equal(state.rolledBack, true)
})

test('5. Terminal Protection: Attempted completed -> pending is rejected', async () => {
  const { pool, state } = createMockPool({
    vehicles: [{ id: 1, availability_status: 'available', is_active: 1 }],
    bookings: [{ id: 14, vehicle_id: 1, booking_status: 'completed' }]
  })

  await assert.rejects(
    async () => {
      await bookingService.updateBookingStatusByAdmin(14, 'pending', {}, pool)
    },
    (err) => {
      assert.equal(err.statusCode, 400)
      assert.match(err.message, /Completed bookings are terminal and cannot be modified/i)
      return true
    }
  )
  assert.equal(state.rolledBack, true)
})

test('6. Active rental cannot be cancelled before vehicle return', async () => {
  const { pool } = createMockPool({
    vehicles: [{ id: 1, availability_status: 'rented', is_active: 1 }],
    bookings: [{ id: 15, vehicle_id: 1, booking_status: 'active' }]
  })

  await assert.rejects(
    async () => {
      await bookingService.updateBookingStatusByAdmin(15, 'cancelled', {}, pool)
    },
    (err) => {
      assert.equal(err.statusCode, 400)
      assert.match(err.message, /Active rentals cannot be cancelled/i)
      return true
    }
  )
})

test('7. Multiple bookings for same vehicle on different dates confirm successfully', async () => {
  const { pool, state } = createMockPool({
    vehicles: [{ id: 2, availability_status: 'available', is_active: 1 }],
    bookings: [
      {
        id: 20,
        vehicle_id: 2,
        start_date: '2026-11-20T10:00:00.000Z',
        end_date: '2026-11-22T10:00:00.000Z',
        booking_status: 'confirmed'
      },
      {
        id: 21,
        vehicle_id: 2,
        start_date: '2026-11-25T10:00:00.000Z',
        end_date: '2026-11-28T10:00:00.000Z',
        booking_status: 'pending'
      }
    ]
  })

  // Confirm booking 21 (non-overlapping future dates)
  const res = await bookingService.updateBookingStatusByAdmin(21, 'confirmed', {}, pool)
  assert.equal(res.data.status, 'confirmed')
  assert.equal(state.bookings[1].booking_status, 'confirmed')
})

test('8. Overlapping confirmed booking blocks confirmation with 409 conflict', async () => {
  const { pool } = createMockPool({
    vehicles: [{ id: 2, availability_status: 'booked', is_active: 1 }],
    bookings: [
      {
        id: 30,
        booking_reference: 'RR-BK-EXISTING',
        vehicle_id: 2,
        start_date: '2026-11-20T10:00:00.000Z',
        end_date: '2026-11-25T10:00:00.000Z',
        booking_status: 'confirmed'
      },
      {
        id: 31,
        booking_reference: 'RR-BK-OVERLAP',
        vehicle_id: 2,
        start_date: '2026-11-22T10:00:00.000Z',
        end_date: '2026-11-27T10:00:00.000Z',
        booking_status: 'pending'
      }
    ]
  })

  await assert.rejects(
    async () => {
      await bookingService.updateBookingStatusByAdmin(31, 'confirmed', {}, pool)
    },
    (err) => {
      assert.equal(err.statusCode, 409)
      assert.match(err.message, /overlapping confirmed booking \(RR-BK-EXISTING\)/i)
      return true
    }
  )
})

test('9. Cancellation retains booked status when another confirmed booking exists', async () => {
  const { pool, state } = createMockPool({
    vehicles: [{ id: 3, availability_status: 'booked', is_active: 1 }],
    bookings: [
      {
        id: 40,
        vehicle_id: 3,
        start_date: '2026-11-20T10:00:00.000Z',
        end_date: '2026-11-22T10:00:00.000Z',
        booking_status: 'confirmed'
      },
      {
        id: 41,
        vehicle_id: 3,
        start_date: '2026-11-25T10:00:00.000Z',
        end_date: '2026-11-27T10:00:00.000Z',
        booking_status: 'confirmed'
      }
    ]
  })

  // Cancel booking 40; booking 41 is still confirmed, so vehicle remains 'booked'
  const res = await bookingService.updateBookingStatusByAdmin(40, 'cancelled', {}, pool)
  assert.equal(res.data.status, 'cancelled')
  assert.equal(state.vehicles[0].availability_status, 'booked')
})

test('10. Completion retains booked status when a future confirmed booking exists', async () => {
  const { pool, state } = createMockPool({
    vehicles: [{ id: 4, availability_status: 'rented', is_active: 1 }],
    bookings: [
      {
        id: 50,
        vehicle_id: 4,
        start_date: '2026-11-10T10:00:00.000Z',
        end_date: '2026-11-15T10:00:00.000Z',
        booking_status: 'active'
      },
      {
        id: 51,
        vehicle_id: 4,
        start_date: '2026-11-20T10:00:00.000Z',
        end_date: '2026-11-25T10:00:00.000Z',
        booking_status: 'confirmed'
      }
    ]
  })

  // Complete booking 50; booking 51 is upcoming, so vehicle transitions from rented -> booked (not available!)
  const res = await bookingService.updateBookingStatusByAdmin(50, 'completed', {}, pool)
  assert.equal(res.data.status, 'completed')
  assert.equal(state.vehicles[0].availability_status, 'booked')
})

test('11. Handover is blocked if vehicle is currently in maintenance or decommissioned', async () => {
  const { pool } = createMockPool({
    vehicles: [{ id: 5, availability_status: 'maintenance', is_active: 1 }],
    bookings: [
      { id: 60, vehicle_id: 5, booking_status: 'confirmed' }
    ]
  })

  await assert.rejects(
    async () => {
      await bookingService.updateBookingStatusByAdmin(60, 'active', {}, pool)
    },
    (err) => {
      assert.equal(err.statusCode, 400)
      assert.match(err.message, /Cannot hand over vehicle in 'maintenance' status/i)
      return true
    }
  )
})

test('12. Completion preserves maintenance status if vehicle was flagged for maintenance', async () => {
  const { pool, state } = createMockPool({
    vehicles: [{ id: 6, availability_status: 'maintenance', is_active: 1 }],
    bookings: [
      { id: 70, vehicle_id: 6, booking_status: 'active' }
    ]
  })

  const res = await bookingService.updateBookingStatusByAdmin(70, 'completed', {}, pool)
  assert.equal(res.data.status, 'completed')
  assert.equal(state.vehicles[0].availability_status, 'maintenance')
})

test('13. Idempotent status update returns no-op without re-triggering updates', async () => {
  const { pool, state } = createMockPool({
    vehicles: [{ id: 7, availability_status: 'booked', is_active: 1 }],
    bookings: [
      { id: 80, vehicle_id: 7, booking_status: 'confirmed' }
    ]
  })

  const res = await bookingService.updateBookingStatusByAdmin(80, 'confirmed', {}, pool)
  assert.equal(res.data.no_change, true)
  assert.equal(res.data.status, 'confirmed')
  assert.equal(state.committed, true)
})
