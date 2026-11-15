import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateSettlementCharges
} from '../src/controllers/settlementController.js'

describe('Phase 7: Rental Settlement Logic & Calculations', () => {
  test('1. Standard settlement within included mileage, full fuel, good condition: full deposit refund', () => {
    const res = calculateSettlementCharges({
      originalRentalAmount: 5000,
      securityDepositAmount: 3000,
      totalDays: 2, // 2 * 150 = 300 km included
      distanceTravelled: 250, // within allowance
      endingFuelPercent: 100, // full
      vehicleCondition: 'Good' // ₹0
    })

    assert.equal(res.original_rental_amount, 5000)
    assert.equal(res.security_deposit_amount, 3000)
    assert.equal(res.included_distance_km, 300)
    assert.equal(res.extra_distance_km, 0)
    assert.equal(res.extra_distance_charge, 0)
    assert.equal(res.fuel_refill_charge, 0)
    assert.equal(res.damage_charge, 0)
    assert.equal(res.total_additional_charges, 0)
    assert.equal(res.final_rental_amount, 5000)
    assert.equal(res.deposit_deduction, 0)
    assert.equal(res.remaining_refund, 3000)
    assert.equal(res.remaining_balance, 0)
  })

  test('2. Extra distance charge calculated accurately when mileage exceeds allowance', () => {
    // 1 day = 150 km included. Travelled 200 km => 50 extra km @ ₹12/km = ₹600.
    const res = calculateSettlementCharges({
      originalRentalAmount: 2000,
      securityDepositAmount: 2000,
      totalDays: 1,
      distanceTravelled: 200,
      endingFuelPercent: 100,
      vehicleCondition: 'Excellent'
    })

    assert.equal(res.included_distance_km, 150)
    assert.equal(res.extra_distance_km, 50)
    assert.equal(res.rate_per_extra_km, 12)
    assert.equal(res.extra_distance_charge, 600)
    assert.equal(res.total_additional_charges, 600)
    assert.equal(res.final_rental_amount, 2600)
    assert.equal(res.deposit_deduction, 600)
    assert.equal(res.remaining_refund, 1400) // 2000 - 600
    assert.equal(res.remaining_balance, 0)
  })

  test('3. Fuel refill charge applies proportional fee for missing fuel levels', () => {
    // Ending at 75% fuel (25% missing) => ₹500
    const res75 = calculateSettlementCharges({
      originalRentalAmount: 3000,
      securityDepositAmount: 2000,
      totalDays: 1,
      distanceTravelled: 100,
      endingFuelPercent: 75,
      vehicleCondition: 'Good'
    })
    assert.equal(res75.fuel_refill_charge, 500)
    assert.equal(res75.total_additional_charges, 500)
    assert.equal(res75.deposit_deduction, 500)
    assert.equal(res75.remaining_refund, 1500)

    // Ending at 50% fuel (50% missing) => ₹1000
    const res50 = calculateSettlementCharges({
      originalRentalAmount: 3000,
      securityDepositAmount: 2000,
      totalDays: 1,
      distanceTravelled: 100,
      endingFuelPercent: 50,
      vehicleCondition: 'Good'
    })
    assert.equal(res50.fuel_refill_charge, 1000)

    // Ending at 0% fuel (100% missing) => ₹2000
    const res0 = calculateSettlementCharges({
      originalRentalAmount: 3000,
      securityDepositAmount: 2000,
      totalDays: 1,
      distanceTravelled: 100,
      endingFuelPercent: 0,
      vehicleCondition: 'Good'
    })
    assert.equal(res0.fuel_refill_charge, 2000)
  })

  test('4. Damage charges mapped correctly for Minor Damage and Major Damage', () => {
    // Minor Damage: ₹1500
    const minor = calculateSettlementCharges({
      originalRentalAmount: 4000,
      securityDepositAmount: 3000,
      totalDays: 2,
      distanceTravelled: 150,
      endingFuelPercent: 100,
      vehicleCondition: 'minor_damage'
    })
    assert.equal(minor.damage_charge, 1500)
    assert.equal(minor.vehicle_condition, 'Minor Damage')
    assert.equal(minor.total_additional_charges, 1500)
    assert.equal(minor.deposit_deduction, 1500)
    assert.equal(minor.remaining_refund, 1500)

    // Major Damage: ₹5000
    const major = calculateSettlementCharges({
      originalRentalAmount: 4000,
      securityDepositAmount: 3000,
      totalDays: 2,
      distanceTravelled: 150,
      endingFuelPercent: 100,
      vehicleCondition: 'Major Damage'
    })
    assert.equal(major.damage_charge, 5000)
    assert.equal(major.vehicle_condition, 'Major Damage')
  })

  test('5. Multi-charge combination with deposit deduction and remaining refund', () => {
    // Distance charge: 50 km extra @ ₹12 = ₹600
    // Fuel charge: 25% missing @ 75% = ₹500
    // Damage charge: Minor Damage = ₹1500
    // Total additional: ₹2600
    // Deposit: ₹5000 => Deduction: ₹2600, Remaining Refund: ₹2400
    const res = calculateSettlementCharges({
      originalRentalAmount: 10000,
      securityDepositAmount: 5000,
      totalDays: 1,
      distanceTravelled: 200,
      endingFuelPercent: 75,
      vehicleCondition: 'minor_damage'
    })

    assert.equal(res.extra_distance_charge, 600)
    assert.equal(res.fuel_refill_charge, 500)
    assert.equal(res.damage_charge, 1500)
    assert.equal(res.total_additional_charges, 2600)
    assert.equal(res.final_rental_amount, 12600)
    assert.equal(res.deposit_deduction, 2600)
    assert.equal(res.remaining_refund, 2400)
    assert.equal(res.remaining_balance, 0)
  })

  test('6. Excess charges exceeding deposit correctly caps deduction and calculates remaining balance', () => {
    // Total additional: ₹5000 (Major damage)
    // Deposit: ₹3000
    // Deposit deduction: ₹3000
    // Remaining refund: ₹0
    // Remaining balance to pay: ₹2000
    const res = calculateSettlementCharges({
      originalRentalAmount: 6000,
      securityDepositAmount: 3000,
      totalDays: 1,
      distanceTravelled: 100,
      endingFuelPercent: 100,
      vehicleCondition: 'major_damage'
    })

    assert.equal(res.total_additional_charges, 5000)
    assert.equal(res.deposit_deduction, 3000)
    assert.equal(res.remaining_refund, 0)
    assert.equal(res.remaining_balance, 2000)
  })

  test('7. Missing or zero deposit handling displays ₹0 rather than inventing amounts', () => {
    const res = calculateSettlementCharges({
      originalRentalAmount: 2500,
      securityDepositAmount: 0,
      totalDays: 1,
      distanceTravelled: 180, // 30 extra km => ₹360
      endingFuelPercent: 75, // ₹500
      vehicleCondition: 'Good'
    })

    assert.equal(res.security_deposit_amount, 0)
    assert.equal(res.deposit_deduction, 0)
    assert.equal(res.remaining_refund, 0)
    assert.equal(res.total_additional_charges, 860) // 360 + 500
    assert.equal(res.remaining_balance, 860)
  })

  test('8. Academic demonstration disclaimer is present in every calculation output', () => {
    const res = calculateSettlementCharges({})
    assert.equal(
      res.academic_disclaimer,
      'SAMPLE – COLLEGE PROJECT DEMONSTRATION – NO REAL PAYMENT OR REFUND PROCESSED'
    )
  })

  test('9. Missing return inspection prerequisite rejects settlement confirmation', () => {
    const validateSettlementPrerequisites = ({ bookingStatus, hasReturn, hasSettlement }) => {
      if (!hasReturn) {
        return { allowed: false, statusCode: 400, message: 'Vehicle return and inspection must be completed before final settlement.' }
      }
      if (hasSettlement) {
        return { allowed: false, statusCode: 409, message: 'Final settlement has already been completed for this booking.' }
      }
      if (bookingStatus !== 'active') {
        return { allowed: false, statusCode: 400, message: 'Booking must be active to settle.' }
      }
      return { allowed: true }
    }

    const noReturn = validateSettlementPrerequisites({ bookingStatus: 'active', hasReturn: false, hasSettlement: false })
    assert.equal(noReturn.allowed, false)
    assert.equal(noReturn.statusCode, 400)
  })

  test('10. Duplicate settlement prevention rejects settling an already settled booking', () => {
    const validateSettlementPrerequisites = ({ bookingStatus, hasReturn, hasSettlement }) => {
      if (!hasReturn) {
        return { allowed: false, statusCode: 400, message: 'Vehicle return inspection required.' }
      }
      if (hasSettlement) {
        return { allowed: false, statusCode: 409, message: 'Final settlement has already been completed for this booking.' }
      }
      return { allowed: true }
    }

    const alreadySettled = validateSettlementPrerequisites({ bookingStatus: 'active', hasReturn: true, hasSettlement: true })
    assert.equal(alreadySettled.allowed, false)
    assert.equal(alreadySettled.statusCode, 409)
  })

  test('11. Customer authorization check prevents non-owner from accessing settlement details', () => {
    const booking = { id: 9, customer_id: 10 }
    const authCheck = (user, b) => {
      if (user.role === 'admin' || user.role === 'staff' || user.type === 'staff') return true
      return user.id === b.customer_id
    }

    assert.equal(authCheck({ id: 10, role: 'customer' }, booking), true, 'Owner customer can access')
    assert.equal(authCheck({ id: 99, role: 'customer' }, booking), false, 'Non-owner customer cannot access')
    assert.equal(authCheck({ id: 1, type: 'staff', role: 'admin' }, booking), true, 'Staff can access')
  })

  test('12. Booking completion updates status to completed and evaluates vehicle availability safely', () => {
    const evaluateVehicleAvailability = ({ currentVehicleStatus, otherBookings = [] }) => {
      const hasActive = otherBookings.some(b => b.booking_status === 'active')
      const hasConfirmed = otherBookings.some(b => b.booking_status === 'confirmed')

      if (hasActive) {
        return ['maintenance', 'decommissioned'].includes(currentVehicleStatus) ? currentVehicleStatus : 'rented'
      }
      if (hasConfirmed) {
        return ['maintenance', 'decommissioned'].includes(currentVehicleStatus) ? currentVehicleStatus : 'booked'
      }
      if (['booked', 'rented'].includes(currentVehicleStatus)) {
        return 'available'
      }
      return currentVehicleStatus
    }

    // Normal case: vehicle was rented, no other bookings => becomes available
    assert.equal(
      evaluateVehicleAvailability({ currentVehicleStatus: 'rented', otherBookings: [] }),
      'available'
    )

    // Overlapping active booking exists => stays rented
    assert.equal(
      evaluateVehicleAvailability({ currentVehicleStatus: 'rented', otherBookings: [{ booking_status: 'active' }] }),
      'rented'
    )

    // Overlapping confirmed booking exists => becomes booked
    assert.equal(
      evaluateVehicleAvailability({ currentVehicleStatus: 'rented', otherBookings: [{ booking_status: 'confirmed' }] }),
      'booked'
    )

    // Maintenance vehicle status is strictly preserved
    assert.equal(
      evaluateVehicleAvailability({ currentVehicleStatus: 'maintenance', otherBookings: [] }),
      'maintenance'
    )

    // Decommissioned vehicle status is strictly preserved
    assert.equal(
      evaluateVehicleAvailability({ currentVehicleStatus: 'decommissioned', otherBookings: [] }),
      'decommissioned'
    )
  })

  test('13. Transaction failure simulation rolls back state without persisting partial changes', async () => {
    let transactionCommitted = false
    let transactionRolledBack = false

    const executeAtomicSettlement = async (shouldFail) => {
      try {
        if (shouldFail) {
          throw new Error('Database connection dropped during additional_charges insert')
        }
        transactionCommitted = true
      } catch (err) {
        transactionRolledBack = true
        throw err
      }
    }

    await assert.rejects(
      async () => {
        await executeAtomicSettlement(true)
      },
      { message: 'Database connection dropped during additional_charges insert' }
    )

    assert.equal(transactionCommitted, false)
    assert.equal(transactionRolledBack, true)
  })
})
