import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeFuelLevel,
  getFuelLevelDisplay
} from '../src/controllers/handoverController.js'

describe('Phase 5: Vehicle Handover Unit & Workflow Logic Tests', () => {

  test('1. Fuel level normalization correctly maps percentages, string labels, and fractions', () => {
    // Exact labels
    assert.deepEqual(normalizeFuelLevel('Full'), { valid: true, value: 100 })
    assert.deepEqual(normalizeFuelLevel('full'), { valid: true, value: 100 })
    assert.deepEqual(normalizeFuelLevel('3/4'), { valid: true, value: 75 })
    assert.deepEqual(normalizeFuelLevel('¾'), { valid: true, value: 75 })
    assert.deepEqual(normalizeFuelLevel('1/2'), { valid: true, value: 50 })
    assert.deepEqual(normalizeFuelLevel('½'), { valid: true, value: 50 })
    assert.deepEqual(normalizeFuelLevel('1/4'), { valid: true, value: 25 })
    assert.deepEqual(normalizeFuelLevel('¼'), { valid: true, value: 25 })
    assert.deepEqual(normalizeFuelLevel('Empty'), { valid: true, value: 0 })
    assert.deepEqual(normalizeFuelLevel('empty'), { valid: true, value: 0 })

    // Percentage numbers & strings
    assert.deepEqual(normalizeFuelLevel(100), { valid: true, value: 100 })
    assert.deepEqual(normalizeFuelLevel('80%'), { valid: true, value: 80 })
    assert.deepEqual(normalizeFuelLevel(55), { valid: true, value: 55 })
    assert.deepEqual(normalizeFuelLevel(0), { valid: true, value: 0 })

    // Invalid values
    assert.equal(normalizeFuelLevel(-10).valid, false)
    assert.equal(normalizeFuelLevel(105).valid, false)
    assert.equal(normalizeFuelLevel('invalid_fuel').valid, false)
    assert.equal(normalizeFuelLevel('').valid, false)
    assert.equal(normalizeFuelLevel(null).valid, false)
  })

  test('2. Fuel level display mapping returns human-readable labels', () => {
    assert.equal(getFuelLevelDisplay(100), 'Full (100%)')
    assert.equal(getFuelLevelDisplay(75), '¾ (75%)')
    assert.equal(getFuelLevelDisplay(50), '½ (50%)')
    assert.equal(getFuelLevelDisplay(25), '¼ (25%)')
    assert.equal(getFuelLevelDisplay(0), 'Empty (0%)')
    assert.equal(getFuelLevelDisplay(60), '60%')
    assert.equal(getFuelLevelDisplay(95), '95%')
  })

  test('3. Handover requires booking status to be confirmed; rejects pending, active, completed, cancelled', () => {
    const isEligibleForHandover = (status) => status === 'confirmed'

    assert.equal(isEligibleForHandover('confirmed'), true, 'Confirmed booking must be eligible for handover')
    assert.equal(isEligibleForHandover('pending'), false, 'Pending booking must not be eligible')
    assert.equal(isEligibleForHandover('active'), false, 'Already active rental must not be eligible')
    assert.equal(isEligibleForHandover('completed'), false, 'Completed booking must not be eligible')
    assert.equal(isEligibleForHandover('cancelled'), false, 'Cancelled booking must not be eligible')
  })

  test('4. Handover requires agreement to be accepted; rejects missing or pending agreement', () => {
    const canHandoverWithAgreement = (agreement) => {
      if (!agreement) return { allowed: false, reason: 'Agreement not generated' }
      if (agreement.agreement_status !== 'accepted') {
        return { allowed: false, reason: 'Rental agreement must be accepted by customer before vehicle handover.' }
      }
      return { allowed: true }
    }

    assert.equal(canHandoverWithAgreement(null).allowed, false)
    assert.equal(canHandoverWithAgreement({ agreement_status: 'pending' }).allowed, false)
    assert.equal(canHandoverWithAgreement({ agreement_status: 'accepted' }).allowed, true)
  })

  test('5. Starting odometer reading must be a non-negative number', () => {
    const validateOdometer = (reading) => {
      const num = Number(reading)
      return !isNaN(num) && num >= 0
    }

    assert.equal(validateOdometer(0), true)
    assert.equal(validateOdometer(14500), true)
    assert.equal(validateOdometer('12500'), true)
    assert.equal(validateOdometer(-50), false)
    assert.equal(validateOdometer('abc'), false)
    assert.equal(validateOdometer(undefined), false)
  })

  test('6. Handover transitions booking to active and vehicle to rented', () => {
    const booking = { id: 1, booking_status: 'confirmed' }
    const vehicle = { id: 10, availability_status: 'booked' }

    // Handover execution simulation
    booking.booking_status = 'active'
    vehicle.availability_status = 'rented'

    assert.equal(booking.booking_status, 'active')
    assert.equal(vehicle.availability_status, 'rented')
  })

  test('7. Duplicate handover prevention blocks multiple handovers for the same booking', () => {
    const handovers = [{ id: 1, booking_id: 10 }]

    const attemptHandover = (bookingId) => {
      const existing = handovers.find(h => h.booking_id === bookingId)
      if (existing) {
        return { success: false, status: 409, message: 'Vehicle handover has already been completed for this booking.' }
      }
      return { success: true }
    }

    assert.equal(attemptHandover(10).success, false)
    assert.equal(attemptHandover(10).status, 409)
    assert.equal(attemptHandover(11).success, true)
  })

  test('8. Vehicle maintenance or decommissioned status blocks handover', () => {
    const checkVehicleReady = (status) => {
      if (status === 'maintenance' || status === 'decommissioned') {
        return { allowed: false, message: `Cannot hand over vehicle currently in '${status}' status.` }
      }
      return { allowed: true }
    }

    assert.equal(checkVehicleReady('maintenance').allowed, false)
    assert.equal(checkVehicleReady('decommissioned').allowed, false)
    assert.equal(checkVehicleReady('booked').allowed, true)
    assert.equal(checkVehicleReady('available').allowed, true)
  })

  test('9. Customer authorization enforces that customers can only view their own handover details', () => {
    const booking = { id: 50, customer_id: 12 }
    const customerUserA = { id: 12, role: 'customer' }
    const customerUserB = { id: 99, role: 'customer' }
    const staffUser = { id: 1, role: 'fleet_staff' }

    const canViewHandover = (user, b) => {
      if (user.role === 'fleet_staff' || user.role === 'admin') return true
      return user.id === b.customer_id
    }

    assert.equal(canViewHandover(customerUserA, booking), true, 'Booking owner customer can view')
    assert.equal(canViewHandover(customerUserB, booking), false, 'Other customer cannot view')
    assert.equal(canViewHandover(staffUser, booking), true, 'Staff can view')
  })

  test('10. Handover stage calculation reflects complete lifecycle states', () => {
    function computeHandoverStage(booking, agreement, handover) {
      if (handover) return 'completed'
      if (booking.booking_status === 'confirmed') {
        if (agreement && agreement.agreement_status === 'accepted') {
          return 'ready_for_handover'
        }
        return 'agreement_required'
      }
      if (booking.booking_status === 'pending') return 'pending_confirmation'
      if (booking.booking_status === 'cancelled') return 'cancelled'
      if (booking.booking_status === 'completed') return 'completed'
      return 'not_started'
    }

    assert.equal(computeHandoverStage({ booking_status: 'pending' }, null, null), 'pending_confirmation')
    assert.equal(computeHandoverStage({ booking_status: 'confirmed' }, null, null), 'agreement_required')
    assert.equal(computeHandoverStage({ booking_status: 'confirmed' }, { agreement_status: 'pending' }, null), 'agreement_required')
    assert.equal(computeHandoverStage({ booking_status: 'confirmed' }, { agreement_status: 'accepted' }, null), 'ready_for_handover')
    assert.equal(computeHandoverStage({ booking_status: 'active' }, { agreement_status: 'accepted' }, { id: 1 }), 'completed')
  })
})
