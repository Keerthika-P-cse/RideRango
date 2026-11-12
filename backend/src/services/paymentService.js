import crypto from 'crypto'
import Razorpay from 'razorpay'
import pool from '../config/db.js'
import { env } from '../config/env.js'

// Initialize Razorpay SDK instance if valid key format
let razorpayInstance = null
try {
  if (env.RAZORPAY.KEY_ID && env.RAZORPAY.KEY_SECRET) {
    razorpayInstance = new Razorpay({
      key_id: env.RAZORPAY.KEY_ID,
      key_secret: env.RAZORPAY.KEY_SECRET
    })
  }
} catch (err) {
  console.warn('Razorpay SDK initialization notice:', err.message)
}

/**
 * Verify Razorpay HMAC-SHA256 payment signature using constant-time comparison.
 */
export function verifyRazorpaySignature(orderId, paymentId, signature, secret = env.RAZORPAY.KEY_SECRET) {
  if (
    typeof orderId !== 'string' || !orderId.trim() ||
    typeof paymentId !== 'string' || !paymentId.trim() ||
    typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature.trim()) ||
    typeof secret !== 'string' || !secret
  ) {
    return false
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex')

  const providedBuf = Buffer.from(signature.trim().toLowerCase(), 'hex')
  const expectedBuf = Buffer.from(expectedSignature, 'hex')

  if (providedBuf.length !== expectedBuf.length) {
    return false
  }

  return crypto.timingSafeEqual(providedBuf, expectedBuf)
}

export const paymentService = {
  /**
   * Create Razorpay server-side payment order
   */
  async createPaymentOrder(bookingId, customerId) {
    // 1. Verify booking existence, ownership, and pending status
    const [bookings] = await pool.query(
      `SELECT b.*, v.make, v.model, c.first_name, c.last_name, c.email, c.phone 
       FROM bookings b
       JOIN vehicles v ON b.vehicle_id = v.id
       JOIN customers c ON b.customer_id = c.id
       WHERE b.id = ? AND b.customer_id = ?`,
      [bookingId, customerId]
    )

    if (bookings.length === 0) {
      throw new Error('Booking not found or not owned by you.')
    }

    const booking = bookings[0]

    if (booking.booking_status === 'confirmed') {
      throw new Error('This booking is already paid and confirmed.')
    }

    if (booking.booking_status === 'cancelled') {
      throw new Error('Cannot process payment for a cancelled booking.')
    }

    // Amount in paise for Razorpay
    const amountInPaise = Math.round(parseFloat(booking.total_amount) * 100)
    let orderId = ''

    // Attempt official Razorpay SDK order creation
    if (razorpayInstance && !env.RAZORPAY.KEY_ID.includes('DevKey')) {
      try {
        const order = await razorpayInstance.orders.create({
          amount: amountInPaise,
          currency: 'INR',
          receipt: booking.booking_reference,
          notes: {
            booking_id: String(booking.id),
            customer_email: booking.email,
            vehicle: `${booking.make} ${booking.model}`
          }
        })
        orderId = order.id
      } catch (err) {
        console.error('Razorpay order creation failed:', err.message)
        throw new Error('Unable to create Razorpay payment order. Please try again shortly.')
      }
    } else if (env.NODE_ENV === 'production') {
      throw new Error('Razorpay payment gateway is not configured in production.')
    } else {
      // Local non-production development order ID simulation
      orderId = `order_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    }

    const txnRef = `TXN-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`

    // Record initiated payment in MySQL
    await pool.query(
      `INSERT INTO payments 
       (transaction_reference, booking_id, customer_id, amount, payment_type, payment_method, payment_status, gateway_transaction_id, payment_notes)
       VALUES (?, ?, ?, ?, 'rental_fee', 'upi', 'initiated', ?, ?)`,
      [txnRef, booking.id, customerId, booking.total_amount, orderId, `Razorpay order ${orderId} initiated`]
    )

    return {
      orderId,
      amount: amountInPaise,
      currency: 'INR',
      keyId: env.RAZORPAY.KEY_ID,
      bookingReference: booking.booking_reference,
      booking: {
        id: booking.id,
        vehicleName: `${booking.make} ${booking.model}`,
        totalAmount: parseFloat(booking.total_amount),
        customerName: `${booking.first_name} ${booking.last_name}`,
        customerEmail: booking.email,
        customerPhone: booking.phone
      }
    }
  },

  /**
   * Verify Razorpay payment signature and confirm booking in MySQL
   */
  async verifyPayment(customerId, payload, dbPool = pool, razorpayClient = razorpayInstance) {
    const {
      booking_id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      payment_method = 'upi',
      amount,
      currency
    } = payload || {}

    if (!booking_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new Error('Payment verification parameters missing.')
    }

    if (currency !== undefined && String(currency).toUpperCase() !== 'INR') {
      throw new Error('Unsupported payment currency. Expected INR.')
    }

    // 1. Strict Backend HMAC-SHA256 Signature Verification (no test-prefix bypass)
    const isValidSignature = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      env.RAZORPAY.KEY_SECRET
    )

    if (!isValidSignature) {
      throw new Error('Invalid payment signature. Payment verification failed on server.')
    }

    if (env.NODE_ENV === 'production' && (!razorpayClient || env.RAZORPAY.KEY_ID.includes('DevKey'))) {
      throw new Error('Razorpay payment gateway is not configured in production.')
    }

    const connection = await dbPool.getConnection()

    try {
      await connection.beginTransaction()

      // 2. Fetch and lock booking owned by this customer
      const [bookings] = await connection.query(
        `SELECT id, vehicle_id, booking_reference, total_amount, booking_status 
         FROM bookings 
         WHERE id = ? AND customer_id = ? 
         FOR UPDATE`,
        [booking_id, customerId]
      )

      if (bookings.length === 0) {
        throw new Error('Booking not found or not owned by you.')
      }

      const booking = bookings[0]

      if (booking.booking_status === 'cancelled') {
        throw new Error('Cannot verify payment for a cancelled booking.')
      }

      if (booking.booking_status === 'confirmed') {
        await connection.commit()
        return {
          success: true,
          alreadyConfirmed: true,
          bookingReference: booking.booking_reference,
          message: 'Booking has already been confirmed.'
        }
      }

      if (booking.booking_status !== 'pending') {
        throw new Error(`Cannot verify payment for a booking with status: ${booking.booking_status}.`)
      }

      // 3. Verify the Razorpay order belongs to this booking & customer
      const [orderPayments] = await connection.query(
        `SELECT id, amount, payment_status 
         FROM payments 
         WHERE booking_id = ? AND customer_id = ? AND gateway_transaction_id = ? 
         ORDER BY id DESC 
         LIMIT 1 
         FOR UPDATE`,
        [booking_id, customerId, razorpay_order_id]
      )

      if (orderPayments.length === 0) {
        throw new Error('Payment order not found for this booking and customer.')
      }

      const orderPayment = orderPayments[0]

      if (orderPayment.payment_status === 'success') {
        await connection.commit()
        return {
          success: true,
          alreadyConfirmed: true,
          bookingReference: booking.booking_reference,
          message: 'Payment has already been verified.'
        }
      }

      if (orderPayment.payment_status !== 'initiated') {
        throw new Error(`Payment order is in '${orderPayment.payment_status}' state and cannot be verified.`)
      }

      // 4. Prevent duplicate successful payment for the same booking
      const [existingSuccessPayments] = await connection.query(
        `SELECT id FROM payments 
         WHERE booking_id = ? AND payment_status = 'success' 
         LIMIT 1`,
        [booking_id]
      )

      if (existingSuccessPayments.length > 0) {
        await connection.commit()
        return {
          success: true,
          alreadyConfirmed: true,
          bookingReference: booking.booking_reference,
          message: 'Booking already has a verified payment.'
        }
      }

      // 5. Verify amount matches booking total (and optional payload amount in paise)
      const expectedTotal = parseFloat(booking.total_amount)
      const orderAmount = parseFloat(orderPayment.amount)
      if (!Number.isFinite(expectedTotal) || !Number.isFinite(orderAmount) || Math.abs(orderAmount - expectedTotal) > 0.01) {
        throw new Error('Payment amount mismatch with booking total.')
      }

      const expectedAmountInPaise = Math.round(expectedTotal * 100)
      if (amount !== undefined && Number(amount) !== expectedAmountInPaise) {
        throw new Error('Payment amount mismatch with expected order amount.')
      }

      // 6. Verify payment capture/status via Razorpay API when configured (or injected in tests)
      const shouldVerifyWithGateway =
        (razorpayClient && !env.RAZORPAY.KEY_ID.includes('DevKey')) ||
        (razorpayClient && razorpayClient !== razorpayInstance)

      if (shouldVerifyWithGateway) {
        let paymentDetails
        try {
          paymentDetails = await razorpayClient.payments.fetch(razorpay_payment_id)
        } catch (gatewayErr) {
          throw new Error(`Unable to verify payment status with Razorpay: ${gatewayErr.message}`)
        }

        if (!paymentDetails || paymentDetails.order_id !== razorpay_order_id) {
          throw new Error('Razorpay payment does not match the expected order ID.')
        }

        if (String(paymentDetails.currency || '').toUpperCase() !== 'INR') {
          throw new Error('Razorpay payment currency mismatch. Expected INR.')
        }

        if (Number(paymentDetails.amount) !== expectedAmountInPaise) {
          throw new Error('Razorpay payment amount mismatch with expected order amount.')
        }

        if (paymentDetails.status === 'authorized') {
          const captured = await razorpayClient.payments.capture(
            razorpay_payment_id,
            expectedAmountInPaise,
            'INR'
          )
          if (!captured || captured.status !== 'captured') {
            throw new Error('Razorpay payment capture did not succeed.')
          }
        } else if (paymentDetails.status !== 'captured') {
          throw new Error(`Razorpay payment is not captured (status: ${paymentDetails.status || 'unknown'}).`)
        }
      }

      // Allowed payment methods in schema enum
      const validMethods = ['upi', 'net_banking', 'credit_card', 'debit_card', 'cash']
      const sanitizedMethod = typeof payment_method === 'string' && validMethods.includes(payment_method.toLowerCase())
        ? payment_method.toLowerCase()
        : 'upi'

      // 6. Mark payment as verified & successful
      await connection.query(
        `UPDATE payments 
         SET payment_status = 'success',
             gateway_transaction_id = ?,
             payment_method = ?,
             paid_at = NOW(),
             payment_notes = 'Verified via Razorpay'
         WHERE id = ?`,
        [razorpay_payment_id, sanitizedMethod, orderPayment.id]
      )

      // 7. Update booking status to confirmed
      await connection.query(
        `UPDATE bookings 
         SET booking_status = 'confirmed' 
         WHERE id = ?`,
        [booking_id]
      )

      // 8. Sync vehicle availability status to booked
      await connection.query(
        `UPDATE vehicles 
         SET availability_status = 'booked' 
         WHERE id = ?`,
        [booking.vehicle_id]
      )

      await connection.commit()

      return {
        success: true,
        bookingId: booking.id,
        bookingReference: booking.booking_reference,
        paymentId: razorpay_payment_id,
        status: 'confirmed'
      }
    } catch (err) {
      await connection.rollback()
      throw err
    } finally {
      connection.release()
    }
  },

  /**
   * Record a failed or cancelled payment attempt
   */
  async recordPaymentFailure(customerId, payload) {
    const { booking_id, razorpay_order_id, error_description } = payload

    if (!booking_id) return { recorded: false }

    const txnRef = `TXN-FAIL-${Date.now().toString(36).toUpperCase()}`

    await pool.query(
      `INSERT INTO payments 
       (transaction_reference, booking_id, customer_id, amount, payment_type, payment_method, payment_status, gateway_transaction_id, payment_notes)
       SELECT ?, b.id, ?, b.total_amount, 'rental_fee', 'upi', 'failed', ?, ?
       FROM bookings b 
       WHERE b.id = ? AND b.customer_id = ?`,
      [
        txnRef,
        customerId,
        razorpay_order_id || null,
        error_description || 'Customer cancelled or transaction declined by bank',
        booking_id,
        customerId
      ]
    )

    return { recorded: true }
  }
}

export default paymentService
