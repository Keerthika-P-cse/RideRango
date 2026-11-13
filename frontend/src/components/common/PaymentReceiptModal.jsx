import { useState, useEffect, useId } from 'react'
import {
  Printer,
  X,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Clock,
  Car,
  User,
  CreditCard,
  ShieldCheck,
  FileText
} from 'lucide-react'
import api from '../../services/api.js'
import './PaymentReceiptModal.css'

const CURRENT_YEAR = new Date().getFullYear()

/**
 * Deterministically formats a unique Payment Receipt number from transaction/booking references.
 * Example: 'TXN-ML0A29-8472' -> 'RR-REC-ML0A29-8472'
 */
function formatReceiptNumber(booking) {
  if (!booking) return 'RR-REC-PENDING'
  if (booking.transaction_reference) {
    const cleanTxn = String(booking.transaction_reference).replace(/^TXN-/, '').trim()
    return `RR-REC-${cleanTxn}`
  }
  if (booking.booking_reference) {
    const cleanBk = String(booking.booking_reference).replace(/^RR-BK-/, '').trim()
    return `RR-REC-${cleanBk}`
  }
  return `RR-REC-${booking.id || 'CONFIRMED'}`
}

/**
 * Determines whether a booking/payment represents a simulated DEMO transaction.
 */
function isDemoPayment(booking) {
  if (!booking) return false
  const txn = String(booking.gateway_transaction_id || '')
  const notes = String(booking.payment_notes || '')
  return txn.startsWith('DEMO-') || notes.includes('DEMO PAYMENT') || booking.isDemo === true
}

export default function PaymentReceiptModal({
  isOpen,
  onClose,
  booking: initialBooking,
  bookingId
}) {
  const [fetchResult, setFetchResult] = useState({ id: null, data: null, error: '' })
  const [loading, setLoading] = useState(false)
  const titleId = useId()

  const targetId = bookingId || initialBooking?.id
  const hasFullDetails = Boolean(
    initialBooking?.id === targetId &&
    initialBooking?.first_name &&
    initialBooking?.transaction_reference &&
    initialBooking?.paid_at
  )

  const fetchedBooking = fetchResult.id === targetId ? fetchResult.data : null
  const error = fetchResult.id === targetId ? fetchResult.error : ''

  // Derive displayed booking strictly matching the active targetId
  const booking = (fetchedBooking?.id === targetId)
    ? fetchedBooking
    : (initialBooking?.id === targetId && hasFullDetails ? initialBooking : null)

  const isFetching = loading || Boolean(isOpen && targetId && !hasFullDetails && !booking && !error)

  // Fetch authoritative fresh booking details with active-request guard and targetId validation
  useEffect(() => {
    let isCurrentRequest = true

    if (isOpen && targetId && !hasFullDetails) {
      api.getBookingById(targetId)
        .then((res) => {
          if (isCurrentRequest) {
            if (res && res.success && res.data && res.data.id === targetId) {
              setFetchResult({ id: targetId, data: res.data, error: '' })
            } else {
              setFetchResult({
                id: targetId,
                data: null,
                error: res?.message || 'Unable to retrieve authoritative payment receipt data.'
              })
            }
          }
        })
        .catch((err) => {
          if (isCurrentRequest) {
            setFetchResult({
              id: targetId,
              data: null,
              error: err.message || 'Failed to load booking payment receipt.'
            })
          }
        })
        .finally(() => {
          if (isCurrentRequest) setLoading(false)
        })
    }

    return () => {
      isCurrentRequest = false
    }
  }, [isOpen, targetId, hasFullDetails])

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handlePrint = () => {
    window.print()
  }

  const isPaid = booking?.payment_status === 'success' || (booking?.booking_status === 'confirmed' && Boolean(booking?.paid_at))
  const isRefunded = Boolean(booking?.refund_status || booking?.payment_status === 'refunded')
  const isDemo = isDemoPayment(booking)
  const receiptNumber = formatReceiptNumber(booking)

  // Customer display name
  const customerName =
    [booking?.first_name, booking?.last_name].filter(Boolean).join(' ').trim() ||
    'Customer on File'

  // Format currency
  const formatINR = (val) => {
    const num = parseFloat(val)
    if (!Number.isFinite(num)) return '0.00'
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // Format dates
  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—'
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return String(dateStr)
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return String(dateStr)
    }
  }

  const formatDateOnly = (dateStr) => {
    if (!dateStr) return '—'
    try {
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return String(dateStr)
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      })
    } catch {
      return String(dateStr)
    }
  }

  return (
    <div
      className="receipt-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="receipt-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Top Controls (Hidden on Print) */}
        <div className="receipt-modal-topbar no-print">
          <div className="receipt-modal-heading">
            <FileText size={18} className="heading-icon" />
            <span>Booking Payment Document</span>
          </div>
          <div className="receipt-modal-actions">
            {isPaid && !isRefunded && (
              <button
                type="button"
                onClick={handlePrint}
                className="btn-receipt-action btn-receipt-print"
                title="Print Receipt or Save as PDF"
              >
                <Printer size={16} />
                <span>Print / Save as PDF</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="btn-receipt-action btn-receipt-close"
              aria-label="Close Receipt Modal"
            >
              <X size={18} />
              <span>Close</span>
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isFetching && (
          <div className="receipt-state-card no-print">
            <div className="receipt-spinner"></div>
            <p>Retrieving authoritative payment receipt details...</p>
          </div>
        )}

        {/* Error State */}
        {!isFetching && error && (
          <div className="receipt-state-card receipt-error-state no-print">
            <AlertCircle size={36} className="state-icon error-icon" />
            <h3>Receipt Unavailable</h3>
            <p>{error}</p>
            <button type="button" onClick={onClose} className="btn-state-action">
              Close
            </button>
          </div>
        )}

        {/* Payment Incomplete / Not Paid State Safeguard */}
        {!isFetching && !error && (!isPaid || isRefunded) && (
          <div className="receipt-state-card receipt-warning-state no-print">
            <AlertCircle size={36} className="state-icon warning-icon" />
            <h3>
              {isRefunded ? 'Booking Refunded' : 'Payment Not Confirmed'}
            </h3>
            <p>
              {isRefunded
                ? `This booking was refunded (Ref: ${booking?.refund_reference || 'N/A'}, Amount: ₹${formatINR(booking?.refund_amount || 0)}). An official Paid Receipt is not applicable for refunded transactions.`
                : `This booking is in '${booking?.booking_status || 'pending'}' status. An official Paid Receipt is only issued once payment has been successfully completed and verified by the backend.`}
            </p>
            <div className="state-details-row">
              <span>Booking Reference: <strong>{booking?.booking_reference || 'N/A'}</strong></span>
              <span>Status: <strong className="status-badge-inline">{booking?.booking_status || 'pending'}</strong></span>
            </div>
            <button type="button" onClick={onClose} className="btn-state-action">
              Close
            </button>
          </div>
        )}

        {/* AUTHORITATIVE PAYMENT RECEIPT DOCUMENT (Printable Area) */}
        {!isFetching && !error && isPaid && !isRefunded && booking && (
          <article
            id="riderango-payment-receipt"
            className="riderango-receipt-card payment-receipt-print-area"
          >
            {/* DEMO Notice Banner (if simulated transaction) */}
            {isDemo && (
              <div className="receipt-demo-banner" role="note">
                <span className="demo-tag">DEMO PAYMENT • SIMULATED TRANSACTION</span>
                <p>
                  This transaction was simulated in RideRango Demonstration Mode. No real money was charged or transferred. This receipt is issued for testing and demonstration purposes only.
                </p>
              </div>
            )}

            {/* Document Header */}
            <header className="receipt-header">
              <div className="receipt-brand-col">
                <div className="receipt-brand-title-row">
                  <div className="receipt-logo-mark">RR</div>
                  <div>
                    <h1 className="receipt-brand-name">RIDERANGO</h1>
                    <span className="receipt-brand-tagline">Premium Vehicle Rentals</span>
                  </div>
                </div>
                <div className="receipt-company-meta">
                  <span>RideRango Mobility Solutions India</span>
                  <span>Central Operations Hub &bull; Bangalore, Karnataka</span>
                  <span>support@riderango.com &bull; riderango.com</span>
                </div>
              </div>

              <div className="receipt-doc-meta-col">
                <div className="doc-type-badge">
                  <span id={titleId} className="doc-type-label">Payment Receipt</span>
                </div>
                <div className="doc-meta-grid">
                  <div className="meta-pair">
                    <span className="meta-label">Receipt No:</span>
                    <strong className="meta-val receipt-num-mono">{receiptNumber}</strong>
                  </div>
                  <div className="meta-pair">
                    <span className="meta-label">Booking Ref:</span>
                    <strong className="meta-val meta-mono">{booking.booking_reference}</strong>
                  </div>
                  <div className="meta-pair">
                    <span className="meta-label">Receipt Date:</span>
                    <span className="meta-val">{formatDateOnly(booking.paid_at || booking.created_at)}</span>
                  </div>
                  <div className="meta-pair">
                    <span className="meta-label">Payment Status:</span>
                    <span className="meta-val status-paid-pill">
                      <ShieldCheck size={13} />
                      <span>PAID &bull; VERIFIED</span>
                    </span>
                  </div>
                </div>
              </div>
            </header>

            <div className="receipt-divider"></div>

            {/* Customer & Vehicle Info Section */}
            <section className="receipt-two-col-grid" aria-label="Customer and Rental Details">
              {/* Customer Box */}
              <div className="receipt-info-card">
                <div className="info-card-header">
                  <User size={15} className="info-icon" />
                  <h3>Customer Information</h3>
                </div>
                <div className="info-card-body">
                  <div className="info-row">
                    <span className="lbl">Name:</span>
                    <strong className="val">{customerName}</strong>
                  </div>
                  {booking.email && (
                    <div className="info-row">
                      <span className="lbl">Email:</span>
                      <span className="val">{booking.email}</span>
                    </div>
                  )}
                  {booking.phone && (
                    <div className="info-row">
                      <span className="lbl">Phone:</span>
                      <span className="val">{booking.phone}</span>
                    </div>
                  )}
                  {booking.driving_license_number && (
                    <div className="info-row">
                      <span className="lbl">Driving Licence:</span>
                      <span className="val meta-mono">{booking.driving_license_number}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Vehicle Box */}
              <div className="receipt-info-card">
                <div className="info-card-header">
                  <Car size={15} className="info-icon" />
                  <h3>Vehicle Rented</h3>
                </div>
                <div className="info-card-body">
                  <div className="info-row">
                    <span className="lbl">Vehicle:</span>
                    <strong className="val">
                      {[booking.make, booking.model].filter(Boolean).join(' ') || 'Rental Vehicle'}
                    </strong>
                  </div>
                  {booking.registration_number && (
                    <div className="info-row">
                      <span className="lbl">Registration:</span>
                      <strong className="val meta-mono reg-plate">{booking.registration_number}</strong>
                    </div>
                  )}
                  {(booking.category_name || booking.fuel_type || booking.transmission) && (
                    <div className="info-row">
                      <span className="lbl">Specs:</span>
                      <span className="val">
                        {[
                          booking.category_name,
                          booking.fuel_type?.toUpperCase(),
                          booking.transmission?.toUpperCase()
                        ].filter(Boolean).join(' • ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Trip Schedule & Locations */}
            <section className="receipt-itinerary-card" aria-label="Rental Itinerary">
              <div className="itinerary-grid">
                <div className="itin-col">
                  <div className="itin-label-row">
                    <Calendar size={14} className="itin-icon" />
                    <span className="itin-heading">Pickup Schedule</span>
                  </div>
                  <strong className="itin-time">{formatDateTime(booking.start_date)}</strong>
                  <span className="itin-location">{booking.pickup_location || 'Main Hub'}</span>
                </div>

                <div className="itin-col">
                  <div className="itin-label-row">
                    <Clock size={14} className="itin-icon" />
                    <span className="itin-heading">Return Schedule</span>
                  </div>
                  <strong className="itin-time">{formatDateTime(booking.end_date)}</strong>
                  <span className="itin-location">{booking.dropoff_location || booking.pickup_location || 'Main Hub'}</span>
                </div>

                <div className="itin-col itin-duration-col">
                  <div className="itin-label-row">
                    <span className="itin-heading">Total Duration</span>
                  </div>
                  <strong className="itin-duration-val">
                    {booking.total_days} {parseFloat(booking.total_days) === 1 ? 'Day' : 'Days'}
                  </strong>
                  <span className="itin-sub">Self-Drive Rental</span>
                </div>
              </div>
            </section>

            {/* Financial Breakdown Table */}
            <section className="receipt-financial-section" aria-label="Financial Breakdown">
              <h3 className="section-title">Rental Charges & Amount Paid</h3>
              <table className="receipt-pricing-table">
                <thead>
                  <tr>
                    <th className="th-desc">Description</th>
                    <th className="th-rate">Rate / Unit</th>
                    <th className="th-qty">Duration</th>
                    <th className="th-amt">Amount (INR)</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Base Rental Fee */}
                  <tr>
                    <td className="td-desc">
                      <strong>Vehicle Rental Charges</strong>
                      <span className="td-sub">
                        Base self-drive rental for {[booking.make, booking.model].filter(Boolean).join(' ')}
                      </span>
                    </td>
                    <td className="td-rate">₹{formatINR(booking.rental_rate_per_day)} / day</td>
                    <td className="td-qty">{booking.total_days} {parseFloat(booking.total_days) === 1 ? 'day' : 'days'}</td>
                    <td className="td-amt">₹{formatINR(booking.base_rental_amount)}</td>
                  </tr>

                  {/* Security Deposit (Refundable) */}
                  {parseFloat(booking.security_deposit_amount || 0) > 0 && (
                    <tr>
                      <td className="td-desc">
                        <strong>Security Deposit (Refundable)</strong>
                        <span className="td-sub">
                          Refundable security deposit against vehicle damages, tolls, or late returns
                        </span>
                      </td>
                      <td className="td-rate">Standard</td>
                      <td className="td-qty">1</td>
                      <td className="td-amt">₹{formatINR(booking.security_deposit_amount)}</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="tr-total">
                    <td colSpan="3" className="td-total-label">
                      Total Rental Amount Paid:
                    </td>
                    <td className="td-total-amount">
                      ₹{formatINR(booking.paid_amount || booking.total_amount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </section>

            {/* Payment Verification Information Box */}
            <section className="receipt-payment-meta-box" aria-label="Payment Transaction Record">
              <div className="payment-meta-title-row">
                <CreditCard size={16} className="pay-icon" />
                <h4>Payment Transaction Details</h4>
              </div>

              <div className="payment-meta-grid">
                <div className="pay-pair">
                  <span className="pay-lbl">Payment Method:</span>
                  <strong className="pay-val">
                    {booking.payment_method ? String(booking.payment_method).toUpperCase() : 'UPI'}
                  </strong>
                </div>

                <div className="pay-pair">
                  <span className="pay-lbl">Payment Date & Time:</span>
                  <span className="pay-val">{formatDateTime(booking.paid_at || booking.created_at)}</span>
                </div>

                <div className="pay-pair">
                  <span className="pay-lbl">Internal Txn Reference:</span>
                  <span className="pay-val meta-mono">{booking.transaction_reference || 'N/A'}</span>
                </div>

                <div className="pay-pair">
                  <span className="pay-lbl">Gateway Transaction ID:</span>
                  <span className="pay-val meta-mono">{booking.gateway_transaction_id || 'N/A'}</span>
                </div>
              </div>

              {booking.payment_notes && (
                <div className="pay-notes-row">
                  <span className="pay-lbl">Gateway Verification:</span>
                  <span className="pay-notes-text">{booking.payment_notes}</span>
                </div>
              )}
            </section>

            {/* Receipt Footer */}
            <footer className="receipt-footer">
              <div className="receipt-seal-box">
                <div className="seal-circle">
                  <CheckCircle2 size={24} className="seal-icon" />
                  <span className="seal-text">RIDERANGO PAID</span>
                </div>
              </div>
              <div className="receipt-footer-notes">
                <p>
                  This official payment receipt confirms payment captured for the vehicle booking referenced above.
                  Please present this receipt along with a valid physical Driving Licence at pickup.
                </p>
                <p className="footer-copyright">
                  &copy; {CURRENT_YEAR} RideRango Mobility Solutions. All rights reserved. Generated electronically.
                </p>
              </div>
            </footer>
          </article>
        )}
      </div>
    </div>
  )
}
