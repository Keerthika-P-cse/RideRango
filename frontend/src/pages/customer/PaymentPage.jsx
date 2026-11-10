import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Lock,
  MapPin,
  Shield,
  Smartphone,
  Wallet
} from 'lucide-react'
import api from '../../services/api.js'
import { useAuth } from '../../context/useAuth.js'
import './PaymentPage.css'

export default function PaymentPage() {
  const { bookingId } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processingPayment, setProcessingPayment] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [paymentResult, setPaymentResult] = useState(null)
  const [selectedMethod, setSelectedMethod] = useState('upi')
  const [showTestModal, setShowTestModal] = useState(false)
  const [testOrderData, setTestOrderData] = useState(null)

  // Redirect unauthenticated customers
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate(`/login?redirect=/payment/${bookingId}`, { replace: true })
    }
  }, [authLoading, isAuthenticated, bookingId, navigate])

  // Load Razorpay Checkout SDK dynamically
  useEffect(() => {
    if (!document.getElementById('razorpay-sdk-script')) {
      const script = document.createElement('script')
      script.id = 'razorpay-sdk-script'
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.async = true
      document.body.appendChild(script)
    }
  }, [])

  // Load Booking Details
  useEffect(() => {
    let isMounted = true

    async function fetchBooking() {
      if (!bookingId || !isAuthenticated) return
      setLoading(true)
      setError('')

      try {
        const res = await api.getBookingById(bookingId)
        if (isMounted) {
          if (res && res.success && res.data) {
            setBooking(res.data)
            if (res.data.booking_status === 'confirmed') {
              setPaymentSuccess(true)
              setPaymentResult({
                bookingReference: res.data.booking_reference,
                paymentId: res.data.gateway_transaction_id || res.data.transaction_reference || 'VERIFIED-RECORD'
              })
            }
          } else {
            setError(res?.message || 'Unable to retrieve booking details.')
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Error connecting to booking service.')
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    fetchBooking()

    return () => {
      isMounted = false
    }
  }, [bookingId, isAuthenticated])

  // Start Razorpay Payment Flow
  const handleInitiatePayment = async () => {
    setError('')
    setProcessingPayment(true)

    try {
      // 1. Create server-side order
      const orderRes = await api.createPaymentOrder(booking.id)
      if (!orderRes || !orderRes.success || !orderRes.data) {
        throw new Error(orderRes?.message || 'Unable to create payment order.')
      }

      const orderData = orderRes.data

      // Check if official Razorpay checkout script loaded
      if (typeof window.Razorpay === 'function' && !orderData.keyId.includes('DevKey')) {
        const options = {
          key: orderData.keyId,
          amount: orderData.amount,
          currency: orderData.currency || 'INR',
          name: 'RideRango Vehicle Rentals',
          description: `Booking ${orderData.bookingReference}`,
          image: '/favicon.ico',
          order_id: orderData.orderId,
          handler: async function (response) {
            await handleVerifyPayment({
              booking_id: booking.id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              payment_method: selectedMethod
            })
          },
          prefill: {
            name: orderData.booking.customerName,
            email: orderData.booking.customerEmail,
            contact: orderData.booking.customerPhone
          },
          theme: {
            color: '#e50914'
          },
          modal: {
            ondismiss: async function () {
              setProcessingPayment(false)
              await api.recordPaymentFailure({
                booking_id: booking.id,
                razorpay_order_id: orderData.orderId,
                error_description: 'Payment checkout closed by user'
              })
              setError('Payment checkout was closed before completion. You can retry anytime.')
            }
          }
        }

        const rzp = new window.Razorpay(options)
        rzp.on('payment.failed', async function (failedResponse) {
          setProcessingPayment(false)
          await api.recordPaymentFailure({
            booking_id: booking.id,
            razorpay_order_id: orderData.orderId,
            error_description: failedResponse.error?.description || 'Transaction declined'
          })
          setError(`Payment failed: ${failedResponse.error?.description || 'Transaction declined by bank'}.`)
        })

        rzp.open()
      } else {
        // Razorpay Test Mode Simulator (clean inline sandbox for development & testing)
        setTestOrderData(orderData)
        setShowTestModal(true)
        setProcessingPayment(false)
      }
    } catch (err) {
      setProcessingPayment(false)
      setError(err.message || 'Payment initiation failed. Please try again.')
    }
  }

  // Verify Payment on Backend
  const handleVerifyPayment = async (verificationPayload) => {
    setProcessingPayment(true)
    setError('')

    try {
      const res = await api.verifyPayment(verificationPayload)
      if (res && res.success) {
        setPaymentSuccess(true)
        setPaymentResult({
          bookingReference: res.data?.bookingReference || booking.booking_reference,
          paymentId: res.data?.paymentId || verificationPayload.razorpay_payment_id
        })
        setShowTestModal(false)
      } else {
        throw new Error(res?.message || 'Payment verification failed.')
      }
    } catch (err) {
      setError(err.message || 'Server-side payment verification failed.')
    } finally {
      setProcessingPayment(false)
    }
  }

  // Simulate test failure
  const handleSimulateFailure = async () => {
    if (!testOrderData) return
    setProcessingPayment(true)
    try {
      await api.recordPaymentFailure({
        booking_id: booking.id,
        razorpay_order_id: testOrderData.orderId,
        error_description: 'Test mode transaction declined by user'
      })
      setShowTestModal(false)
      setError('Test payment was cancelled or declined. The booking remains pending so you can safely retry.')
    } catch (err) {
      setError(err.message)
    } finally {
      setProcessingPayment(false)
    }
  }

  if (loading || authLoading) {
    return (
      <div className="payment-loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading secure payment checkout...</p>
      </div>
    )
  }

  if (!booking) {
    return (
      <div className="payment-error-screen">
        <div className="payment-card-box">
          <AlertCircle size={40} className="error-icon" />
          <h2>Booking Not Found</h2>
          <p>{error || 'We could not find this booking or you do not have permission to access it.'}</p>
          <Link to="/my-bookings" className="btn btn-primary">
            <span>Go to My Bookings</span>
          </Link>
        </div>
      </div>
    )
  }

  // SUCCESS STATE
  if (paymentSuccess) {
    return (
      <div className="payment-page-wrapper">
        <div className="payment-container success-container">
          <div className="payment-success-card">
            <div className="success-icon-box">
              <CheckCircle2 size={48} className="success-icon" />
            </div>

            <span className="success-badge">Payment Verified & Confirmed</span>
            <h1 className="success-title">Booking Confirmed!</h1>
            <p className="success-desc">
              Your vehicle booking has been confirmed and paid through Razorpay.
            </p>

            <div className="success-reference-box">
              <div className="ref-item">
                <span className="ref-label">Booking Reference:</span>
                <strong className="ref-val">{paymentResult?.bookingReference || booking.booking_reference}</strong>
              </div>
              <div className="ref-item">
                <span className="ref-label">Payment ID:</span>
                <span className="ref-val mono">{paymentResult?.paymentId || 'TXN-CONFIRMED'}</span>
              </div>
              <div className="ref-item">
                <span className="ref-label">Amount Paid:</span>
                <strong className="ref-val">₹{parseFloat(booking.total_amount).toLocaleString('en-IN')}</strong>
              </div>
            </div>

            <div className="success-itinerary-box">
              <h4>Trip Details</h4>
              <div className="itin-grid">
                <div>
                  <span>Vehicle:</span>
                  <strong>{booking.make} {booking.model}</strong>
                </div>
                <div>
                  <span>Pickup Location:</span>
                  <strong>{booking.pickup_location}</strong>
                </div>
                <div>
                  <span>Pickup Date:</span>
                  <strong>{new Date(booking.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} ({new Date(booking.start_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })})</strong>
                </div>
                <div>
                  <span>Return Date:</span>
                  <strong>{new Date(booking.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} ({new Date(booking.end_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })})</strong>
                </div>
              </div>
            </div>

            <div className="success-actions-row">
              <Link to="/my-bookings" className="btn btn-primary">
                <span>View in My Bookings</span>
              </Link>
              <Link to="/vehicles" className="btn btn-secondary">
                <span>Explore More Vehicles</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // CHECKOUT PAYMENT FORM
  return (
    <div className="payment-page-wrapper">
      <div className="payment-container">
        {/* Navigation */}
        <div className="payment-top-nav">
          <Link to={`/booking?vehicleId=${booking.vehicle_id}`} className="btn-back-link">
            <ArrowLeft size={16} />
            <span>Change Booking</span>
          </Link>
          <span className="step-tag">Step 2 of 2: Secure Payment</span>
        </div>

        <div className="payment-header">
          <h1 className="payment-title">Secure Payment Checkout</h1>
          <p className="payment-subtitle">
            Powered by Razorpay &bull; Secure encrypted payment
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="payment-alert alert-error" role="alert">
            <AlertCircle size={20} className="alert-icon" />
            <div className="alert-text">
              <strong>Payment Error</strong>
              <p>{error}</p>
            </div>
          </div>
        )}

        <div className="payment-grid">
          {/* LEFT COLUMN: Payment Method & Pay Action */}
          <div className="payment-methods-column">
            <div className="payment-card">
              <div className="card-header">
                <CreditCard size={18} className="header-icon" />
                <h3>Select Payment Method</h3>
              </div>

              <div className="card-body">
                {/* Method Options */}
                <div className="method-selector-list">
                  <label className={`method-card ${selectedMethod === 'upi' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="upi"
                      checked={selectedMethod === 'upi'}
                      onChange={() => setSelectedMethod('upi')}
                    />
                    <div className="method-info">
                      <Smartphone size={20} className="method-icon" />
                      <div className="method-text">
                        <strong>UPI Instant Payment</strong>
                        <span>Google Pay, PhonePe, Paytm, BHIM UPI</span>
                      </div>
                    </div>
                    <span className="method-pill recommended">Recommended</span>
                  </label>

                  <label className={`method-card ${selectedMethod === 'credit_card' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="credit_card"
                      checked={selectedMethod === 'credit_card'}
                      onChange={() => setSelectedMethod('credit_card')}
                    />
                    <div className="method-info">
                      <CreditCard size={20} className="method-icon" />
                      <div className="method-text">
                        <strong>Credit / Debit Card</strong>
                        <span>Visa, MasterCard, RuPay, Maestro</span>
                      </div>
                    </div>
                  </label>

                  <label className={`method-card ${selectedMethod === 'net_banking' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="net_banking"
                      checked={selectedMethod === 'net_banking'}
                      onChange={() => setSelectedMethod('net_banking')}
                    />
                    <div className="method-info">
                      <Wallet size={20} className="method-icon" />
                      <div className="method-text">
                        <strong>Net Banking</strong>
                        <span>SBI, HDFC, ICICI, Axis, and 50+ Banks</span>
                      </div>
                    </div>
                  </label>
                </div>

                <div className="security-badges-row">
                  <div className="sec-item">
                    <Shield size={16} className="sec-icon" />
                    <span>Razorpay PCI-DSS Compliant</span>
                  </div>
                  <div className="sec-item">
                    <Lock size={16} className="sec-icon" />
                    <span>No card details stored on server</span>
                  </div>
                </div>

                {/* Main Pay Now Action */}
                <button
                  type="button"
                  onClick={handleInitiatePayment}
                  disabled={processingPayment}
                  className="btn btn-primary btn-pay-now"
                >
                  {processingPayment ? (
                    <span>Processing Secure Payment...</span>
                  ) : (
                    <>
                      <Lock size={18} />
                      <span>Pay ₹{parseFloat(booking.total_amount).toLocaleString('en-IN')} Now</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Booking Summary Breakdown */}
          <div className="payment-summary-column">
            <div className="summary-card">
              <h3 className="summary-title">Booking Summary</h3>

              <div className="summary-ref-tag">
                <span>Reference:</span>
                <strong>{booking.booking_reference}</strong>
              </div>

              {/* Vehicle Row */}
              <div className="summary-vehicle-row">
                <div className="veh-text">
                  <span className="veh-cat">{booking.category_name}</span>
                  <h4 className="veh-name">{booking.make} {booking.model}</h4>
                  <span className="veh-reg">Reg: {booking.registration_number}</span>
                </div>
              </div>

              {/* Itinerary */}
              <div className="summary-itinerary">
                <div className="itin-item">
                  <MapPin size={14} className="itin-icon" />
                  <span>{booking.pickup_location}</span>
                </div>
                <div className="itin-item">
                  <Calendar size={14} className="itin-icon" />
                  <span>
                    {new Date(booking.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} &rarr;{' '}
                    {new Date(booking.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div className="itin-item">
                  <Clock size={14} className="itin-icon" />
                  <span>Duration: {booking.total_days} {parseFloat(booking.total_days) === 1 ? 'Day' : 'Days'}</span>
                </div>
              </div>

              {/* Pricing Breakdown */}
              <div className="summary-breakdown">
                <div className="breakdown-line">
                  <span>Daily Rate</span>
                  <span>₹{parseFloat(booking.rental_rate_per_day).toLocaleString('en-IN')} / day</span>
                </div>

                <div className="breakdown-line">
                  <span>Base Rental Fee</span>
                  <span>₹{parseFloat(booking.base_rental_amount).toLocaleString('en-IN')}</span>
                </div>

                <div className="breakdown-line">
                  <span>Refundable Security Deposit</span>
                  <span>₹{parseFloat(booking.security_deposit_amount).toLocaleString('en-IN')}</span>
                </div>

                <div className="breakdown-divider"></div>

                <div className="breakdown-total">
                  <span>Total Amount Payable</span>
                  <strong>₹{parseFloat(booking.total_amount).toLocaleString('en-IN')}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Razorpay Test Mode Checkout Modal (Sandbox & verification) */}
        {showTestModal && testOrderData && (
          <div className="test-payment-overlay">
            <div className="test-payment-modal">
              <div className="modal-top">
                <span className="test-badge">Razorpay Test Gateway (Sandbox)</span>
                <h3>Authorize Payment</h3>
                <p>Simulating Razorpay checkout for development verification without live charges.</p>
              </div>

              <div className="modal-amount-box">
                <span className="lbl">Payable Amount:</span>
                <strong className="amt">₹{(testOrderData.amount / 100).toLocaleString('en-IN')}</strong>
              </div>

              <div className="modal-meta-box">
                <div><span>Order ID:</span> <code>{testOrderData.orderId}</code></div>
                <div><span>Booking Ref:</span> <strong>{testOrderData.bookingReference}</strong></div>
                <div><span>Payment Method:</span> <strong className="upper">{selectedMethod}</strong></div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  disabled={processingPayment}
                  onClick={() => handleVerifyPayment({
                    booking_id: booking.id,
                    razorpay_order_id: testOrderData.orderId,
                    razorpay_payment_id: `pay_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                    razorpay_signature: 'test_signature_verified',
                    payment_method: selectedMethod
                  })}
                  className="btn btn-primary btn-modal-success"
                >
                  <CheckCircle2 size={18} />
                  <span>Authorize & Verify Success</span>
                </button>

                <button
                  type="button"
                  disabled={processingPayment}
                  onClick={handleSimulateFailure}
                  className="btn btn-secondary btn-modal-fail"
                >
                  <span>Simulate Payment Failure / Cancel</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
