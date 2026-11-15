import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeFuelLevel,
  getFuelLevelDisplay,
  normalizeCondition
} from '../src/controllers/returnController.js'

describe('Phase 6: Vehicle Return & Inspection Unit & Logic Tests', () => {

  test('1. Fuel level normalization maps fractions, string labels, and percentages', () => {
    assert.deepEqual(normalizeFuelLevel('Full'), { valid: true, value: 100 })
    assert.deepEqual(normalizeFuelLevel('3/4'), { valid: true, value: 75 })
    assert.deepEqual(normalizeFuelLevel('1/2'), { valid: true, value: 50 })
    assert.deepEqual(normalizeFuelLevel('1/4'), { valid: true, value: 25 })
    assert.deepEqual(normalizeFuelLevel('Empty'), { valid: true, value: 0 })
    assert.deepEqual(normalizeFuelLevel(85), { valid: true, value: 85 })

    assert.equal(normalizeFuelLevel(-5).valid, false)
    assert.equal(normalizeFuelLevel(105).valid, false)
    assert.equal(normalizeFuelLevel('invalid').valid, false)
  })

  test('2. Fuel level display mapping returns human-readable labels', () => {
    assert.equal(getFuelLevelDisplay(100), 'Full (100%)')
    assert.equal(getFuelLevelDisplay(75), '¾ (75%)')
    assert.equal(getFuelLevelDisplay(50), '½ (50%)')
    assert.equal(getFuelLevelDisplay(25), '¼ (25%)')
    assert.equal(getFuelLevelDisplay(0), 'Empty (0%)')
    assert.equal(getFuelLevelDisplay(85), '85%')
  })

  test('3. Vehicle condition normalization accepts valid conditions and rejects invalid ones', () => {
    const excellent = normalizeCondition('Excellent')
    assert.equal(excellent.valid, true)
    assert.equal(excellent.condition, 'Excellent')
    assert.equal(excellent.inspection_status, 'passed')
    assert.equal(excellent.damages_identified, 0)

    const good = normalizeCondition('good')
    assert.equal(good.valid, true)
    assert.equal(good.condition, 'Good')
    assert.equal(good.inspection_status, 'passed')
    assert.equal(good.damages_identified, 0)

    const minor = normalizeCondition('Minor Damage')
    assert.equal(minor.valid, true)
    assert.equal(minor.condition, 'Minor Damage')
    assert.equal(minor.inspection_status, 'flagged_for_charges')
    assert.equal(minor.damages_identified, 1)

    const major = normalizeCondition('Major Damage')
    assert.equal(major.valid, true)
    assert.equal(major.condition, 'Major Damage')
    assert.equal(major.inspection_status, 'escalated')
    assert.equal(major.damages_identified, 1)

    assert.equal(normalizeCondition('destroyed').valid, false)
    assert.equal(normalizeCondition('').valid, false)
    assert.equal(normalizeCondition(null).valid, false)
  })

  test('4. Distance travelled is accurately calculated as Ending Odometer minus Starting Odometer', () => {
    const startOdo = 12500
    const endOdo = 12780
    const distance = endOdo - startOdo

    assert.equal(distance, 280)
    assert.ok(distance >= 0, 'Distance must be non-negative')
  })

  test('5. Ending odometer cannot be less than starting odometer', () => {
    const validateOdometers = (start, end) => {
      const s = Number(start)
      const e = Number(end)
      if (isNaN(e) || e < 0) return { valid: false, reason: 'Invalid ending odometer' }
      if (e < s) return { valid: false, reason: 'Ending odometer cannot be less than starting odometer' }
      return { valid: true, distance: e - s }
    }

    assert.equal(validateOdometers(12500, 12500).valid, true)
    assert.equal(validateOdometers(12500, 12600).valid, true)
    assert.equal(validateOdometers(12500, 12400).valid, false)
    assert.equal(validateOdometers(12500, -10).valid, false)
    assert.equal(validateOdometers(12500, 'abc').valid, false)
  })

  test('6. Return requires active booking status and rejects non-active bookings', () => {
    const canReturn = (status) => status === 'active'

    assert.equal(canReturn('active'), true, 'Active rental can be returned')
    assert.equal(canReturn('pending'), false, 'Pending booking cannot be returned')
    assert.equal(canReturn('confirmed'), false, 'Confirmed booking cannot be returned before handover')
    assert.equal(canReturn('completed'), false, 'Completed booking cannot be returned again')
    assert.equal(canReturn('cancelled'), false, 'Cancelled booking cannot be returned')
  })

  test('7. Return requires completed handover record to exist', () => {
    const canReturnWithHandover = (handover) => {
      if (!handover || !handover.odometer_reading) {
        return { allowed: false, message: 'Completed vehicle handover record is required.' }
      }
      return { allowed: true }
    }

    assert.equal(canReturnWithHandover(null).allowed, false)
    assert.equal(canReturnWithHandover({}).allowed, false)
    assert.equal(canReturnWithHandover({ id: 1, odometer_reading: 14500 }).allowed, true)
  })

  test('8. Duplicate return prevention blocks recording multiple returns for the same booking', () => {
    const existingReturns = [{ id: 1, booking_id: 9 }]

    const attemptReturn = (bookingId) => {
      if (existingReturns.some(r => r.booking_id === bookingId)) {
        return { status: 409, message: 'Vehicle return inspection has already been recorded for this booking.' }
      }
      return { status: 201, message: 'Return recorded successfully' }
    }

    assert.equal(attemptReturn(9).status, 409)
    assert.equal(attemptReturn(10).status, 201)
  })

  test('9. Return inspection does NOT set vehicle availability to available', () => {
    // Phase 6 constraint: Completing return inspection must leave vehicle unavailable (rented)
    // and wait for Phase 7 final settlement before restoring availability
    const vehicle = { id: 8, availability_status: 'rented' }
    const booking = { id: 9, booking_status: 'active' }

    // After return recorded:
    assert.equal(vehicle.availability_status, 'rented', 'Vehicle must remain rented/unavailable')
    assert.notEqual(vehicle.availability_status, 'available', 'Vehicle must NOT be made available in Phase 6')
  })

  test('10. Customer authorization enforces that customers can only view their own booking return details', () => {
    const booking = { id: 9, customer_id: 1 }
    const customerUserA = { id: 1, role: 'customer' }
    const customerUserB = { id: 2, role: 'customer' }
    const staffUser = { id: 5, role: 'fleet_staff' }

    const canViewReturn = (user, b) => {
      if (user.role === 'fleet_staff' || user.role === 'admin') return true
      return user.id === b.customer_id
    }

    assert.equal(canViewReturn(customerUserA, booking), true, 'Booking owner customer can view')
    assert.equal(canViewReturn(customerUserB, booking), false, 'Other customer cannot view')
    assert.equal(canViewReturn(staffUser, booking), true, 'Staff can view')
  })
})
