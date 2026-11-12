import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  MapPin,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  X
} from 'lucide-react'
import api from '../../services/api.js'
import { useAuth } from '../../context/useAuth.js'
import VehicleImage from '../../components/common/VehicleImage.jsx'
import './MyBookingsPage.css'

export default function MyBookingsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(() => Boolean(isAuthenticated))
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Modal states
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [cancellingBooking, setCancellingBooking] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)
  const [actionMessage, setActionMessage] = useState({ type: '', text: '' })
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now())

  const fetchBookings = async () => {
    if (!isAuthenticated) return
    setLoading(true)
    setError('')
    try {
      const res = await api.getMyBookings()
      setBookings(res && res.success && res.data ? res.data : [])
      setNowTimestamp(Date.now())
    } catch (err) {
      setError(err.message || 'Failed to load bookings.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    if (isAuthenticated) {
      api.getMyBookings()
        .then((res) => {
          if (isMounted) {
            setBookings(res && res.success && res.data ? res.data : [])
            setNowTimestamp(Date.now())
            setLoading(false)
          }
        })
        .catch((err) => {
          if (isMounted) {
            setError(err.message || 'Failed to load bookings.')
            setLoading(false)
          }
        })
    }

    return () => {
      isMounted = false
    }
  }, [isAuthenticated])

  // Filter bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (statusFilter === 'all') return true
      if (statusFilter === 'pending') return b.booking_status === 'pending'
      if (statusFilter === 'confirmed') return b.booking_status === 'confirmed' || b.booking_status === 'active'
      if (statusFilter === 'cancelled') return b.booking_status === 'cancelled'
      if (statusFilter === 'completed') return b.booking_status === 'completed'
      return true
    })
  }, [bookings, statusFilter])

  // Open Details Modal
  const handleOpenDetails = (booking) => {
    setSelectedBooking(booking)
  }

  // Open Cancel Dialog
  const handleOpenCancelDialog = (booking) => {
    setCancellingBooking(booking)
    setCancelReason('')
    setActionMessage({ type: '', text: '' })
  }

  // Confirm Cancellation
  const handleConfirmCancel = async () => {
    if (!cancellingBooking) return
    setCancelLoading(true)

    try {
      const res = await api.cancelBooking(cancellingBooking.id, cancelReason)
      if (res && res.success) {
        const refundMsg = res.data?.refund_initiated
          ? ` DEMO 100% refund of ₹${parseFloat(res.data.refund_amount || 0).toLocaleString('en-IN')} (${res.data.refund_status || 'refunded'}) simulated — no real money transferred.`
          : ''
        setActionMessage({
          type: 'success',
          text: `Booking ${cancellingBooking.booking_reference} has been cancelled.${refundMsg}`
        })
        setCancellingBooking(null)
        await fetchBookings()
      } else {
        throw new Error(res?.message || 'Cancellation failed.')
      }
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err.message || 'Unable to cancel booking.'
      })
    } finally {
      setCancelLoading(false)
    }
  }

  // Helper for Status Pills
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'confirmed':
        return <span className="status-badge status-confirmed">Confirmed</span>
      case 'pending':
        return <span className="status-badge status-pending">Pending Payment</span>
      case 'active':
        return <span className="status-badge status-active">Trip Active</span>
      case 'completed':
        return <span className="status-badge status-completed">Completed</span>
      case 'cancelled':
        return <span className="status-badge status-cancelled">Cancelled</span>
      default:
        return <span className="status-badge">{status}</span>
    }
  }

  if (authLoading) {
    return (
      <div className="bookings-loading-screen">
        <div className="loading-spinner"></div>
        <p>Checking authentication...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="bookings-auth-gate">
        <div className="gate-card">
          <Calendar size={48} className="gate-icon" />
          <h2>Customer Sign In Required</h2>
          <p>Please log in with your RideRango account to view and manage your vehicle bookings.</p>
          <Link to="/login?redirect=/my-bookings" className="btn btn-primary">
            <span>Log In / Register</span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="my-bookings-wrapper">
      <div className="bookings-container">
        {/* Header */}
        <div className="bookings-header-row">
          <div>
            <span className="page-tag">Customer Portal</span>
            <h1 className="page-title">My Bookings</h1>
            <p className="page-subtitle">
              Manage your upcoming trips, vehicle passes, and booking receipts.
            </p>
          </div>

          <div className="header-actions">
            <button
              type="button"
              onClick={fetchBookings}
              className="btn btn-secondary btn-refresh"
              title="Refresh bookings"
            >
              <RefreshCw size={15} />
              <span>Refresh</span>
            </button>
            <Link to="/vehicles" className="btn btn-primary">
              <span>Book Another Vehicle</span>
            </Link>
          </div>
        </div>

        {/* Action / Success Banner */}
        {actionMessage.text && (
          <div className={`bookings-alert alert-${actionMessage.type}`} role="alert">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 size={18} className="alert-icon" />
            ) : (
              <AlertCircle size={18} className="alert-icon" />
            )}
            <span>{actionMessage.text}</span>
            <button
              type="button"
              onClick={() => setActionMessage({ type: '', text: '' })}
              className="btn-dismiss-alert"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Filter Tabs Bar */}
        <div className="bookings-tabs-bar" role="tablist">
          <button
            type="button"
            className={`booking-tab-btn ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All Bookings ({bookings.length})
          </button>
          <button
            type="button"
            className={`booking-tab-btn ${statusFilter === 'confirmed' ? 'active' : ''}`}
            onClick={() => setStatusFilter('confirmed')}
          >
            Confirmed ({bookings.filter((b) => b.booking_status === 'confirmed' || b.booking_status === 'active').length})
          </button>
          <button
            type="button"
            className={`booking-tab-btn ${statusFilter === 'pending' ? 'active' : ''}`}
            onClick={() => setStatusFilter('pending')}
          >
            Pending Payment ({bookings.filter((b) => b.booking_status === 'pending').length})
          </button>
          <button
            type="button"
            className={`booking-tab-btn ${statusFilter === 'completed' ? 'active' : ''}`}
            onClick={() => setStatusFilter('completed')}
          >
            Completed ({bookings.filter((b) => b.booking_status === 'completed').length})
          </button>
          <button
            type="button"
            className={`booking-tab-btn ${statusFilter === 'cancelled' ? 'active' : ''}`}
            onClick={() => setStatusFilter('cancelled')}
          >
            Cancelled ({bookings.filter((b) => b.booking_status === 'cancelled').length})
          </button>
        </div>

        {/* Bookings List / States */}
        {loading ? (
          <div className="bookings-loading-box">
            <div className="loading-spinner"></div>
            <p>Loading your bookings...</p>
          </div>
        ) : error ? (
          <div className="bookings-error-box">
            <AlertCircle size={32} />
            <p>{error}</p>
            <button type="button" onClick={fetchBookings} className="btn btn-secondary">
              Try Again
            </button>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="bookings-empty-box">
            <Calendar size={48} className="empty-icon" />
            <h3>No Bookings Found</h3>
            <p>
              {statusFilter === 'all'
                ? "You haven't made any bookings yet. Choose from our vehicles to start exploring."
                : `You do not have any bookings with status "${statusFilter}".`}
            </p>
            <Link to="/vehicles" className="btn btn-primary">
              <span>Explore Vehicles</span>
            </Link>
          </div>
        ) : (
          <div className="bookings-cards-grid">
            {filteredBookings.map((booking) => {
              const isPending = booking.booking_status === 'pending'
              const isConfirmed = booking.booking_status === 'confirmed'
              const bookingStartTimestamp = new Date(booking.start_date).getTime()
              const canCancel = (isPending || isConfirmed) && bookingStartTimestamp > nowTimestamp

              return (
                <div key={booking.id} className="booking-item-card">
                  {/* Top Bar */}
                  <div className="item-top-bar">
                    <div className="ref-group">
                      <span className="ref-lbl">Ref:</span>
                      <strong className="ref-code">{booking.booking_reference}</strong>
                    </div>
                    {renderStatusBadge(booking.booking_status)}
                  </div>

                  {/* Body Content */}
                  <div className="item-body">
                    <VehicleImage
                      vehicle={booking}
                      src={booking.image}
                      alt={`${booking.make} ${booking.model}`}
                      className="item-vehicle-photo"
                      loading="lazy"
                    />

                    <div className="item-meta">
                      <div className="item-title-row">
                        <span className="item-cat-badge">{booking.category_name}</span>
                        <h3 className="item-veh-title">{booking.make} {booking.model}</h3>
                        <span className="item-reg-code">Reg: {booking.registration_number}</span>
                      </div>

                      <div className="item-schedule-grid">
                        <div className="sched-item">
                          <MapPin size={14} className="sched-icon" />
                          <span>{booking.pickup_location}</span>
                        </div>
                        <div className="sched-item">
                          <Calendar size={14} className="sched-icon" />
                          <span>
                            {new Date(booking.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} &rarr;{' '}
                            {new Date(booking.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <div className="sched-item">
                          <Clock size={14} className="sched-icon" />
                          <span>{booking.total_days} {parseFloat(booking.total_days) === 1 ? 'Day' : 'Days'} Duration</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer & Actions */}
                  <div className="item-footer">
                    <div className="item-pricing">
                      <span className="price-lbl">Total Amount</span>
                      <strong className="price-val">₹{parseFloat(booking.total_amount).toLocaleString('en-IN')}</strong>
                      <span className="payment-indicator">
                        {booking.refund_status ? (
                          <span className="paid-tag">
                            DEMO Refund: ₹{parseFloat(booking.refund_amount || booking.paid_amount || booking.total_amount).toLocaleString('en-IN')} ({booking.refund_status})
                          </span>
                        ) : isConfirmed ? (
                          <span className="paid-tag">Paid via {booking.payment_method?.toUpperCase() || 'DEMO'}</span>
                        ) : isPending ? (
                          <span className="unpaid-tag">Payment Pending</span>
                        ) : (
                          <span className="neutral-tag">{booking.booking_status}</span>
                        )}
                      </span>
                    </div>

                    <div className="item-actions">
                      <button
                        type="button"
                        onClick={() => handleOpenDetails(booking)}
                        className="btn btn-secondary btn-action"
                      >
                        <Eye size={15} />
                        <span>Details</span>
                      </button>

                      {isPending && (
                        <Link
                          to={`/payment/${booking.id}`}
                          className="btn btn-primary btn-action"
                        >
                          <CreditCard size={15} />
                          <span>Pay Now</span>
                        </Link>
                      )}

                      {canCancel && (
                        <button
                          type="button"
                          onClick={() => handleOpenCancelDialog(booking)}
                          className="btn btn-cancel-booking"
                          title="Cancel this booking"
                        >
                          <RotateCcw size={14} />
                          <span>Cancel</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* DETAILS MODAL */}
        {selectedBooking && (
          <div className="modal-backdrop" onClick={() => setSelectedBooking(null)}>
            <div className="booking-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <span className="modal-eyebrow">Booking Details</span>
                  <h3 className="modal-title">{selectedBooking.booking_reference}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedBooking(null)}
                  className="btn-modal-close"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body">
                {/* Status Bar */}
                <div className="modal-status-bar">
                  <span>Current Status:</span>
                  {renderStatusBadge(selectedBooking.booking_status)}
                </div>

                {/* Vehicle Details */}
                <div className="modal-vehicle-section">
                  <VehicleImage
                    vehicle={selectedBooking}
                    src={selectedBooking.image}
                    alt={`${selectedBooking.make} ${selectedBooking.model}`}
                    className="modal-vehicle-img"
                    loading="eager"
                  />
                  <div>
                    <span className="sec-cat">{selectedBooking.category_name}</span>
                    <h4 className="sec-name">{selectedBooking.make} {selectedBooking.model}</h4>
                    <p className="sec-reg">Registration: <strong>{selectedBooking.registration_number}</strong></p>
                    <p className="sec-fuel">Fuel: {selectedBooking.fuel_type} &bull; Transmission: {selectedBooking.transmission}</p>
                  </div>
                </div>

                {/* Dates & Pickup */}
                <div className="modal-section-grid">
                  <div className="modal-info-box">
                    <span className="info-lbl">Pickup Schedule</span>
                    <strong className="info-val">
                      {new Date(selectedBooking.start_date).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </strong>
                    <span className="info-sub">{selectedBooking.pickup_location}</span>
                  </div>

                  <div className="modal-info-box">
                    <span className="info-lbl">Return Schedule</span>
                    <strong className="info-val">
                      {new Date(selectedBooking.end_date).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </strong>
                    <span className="info-sub">{selectedBooking.dropoff_location || selectedBooking.pickup_location}</span>
                  </div>
                </div>

                {/* Price Breakdown */}
                <div className="modal-price-breakdown">
                  <h5 className="breakdown-title">Pricing Breakdown</h5>
                  <div className="price-row">
                    <span>Daily Rate</span>
                    <span>₹{parseFloat(selectedBooking.rental_rate_per_day).toLocaleString('en-IN')} / day</span>
                  </div>
                  <div className="price-row">
                    <span>Duration</span>
                    <span>{selectedBooking.total_days} {parseFloat(selectedBooking.total_days) === 1 ? 'Day' : 'Days'}</span>
                  </div>
                  <div className="price-row">
                    <span>Base Rental Amount</span>
                    <span>₹{parseFloat(selectedBooking.base_rental_amount).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="price-row">
                    <span>Security Deposit (Refundable)</span>
                    <span>₹{parseFloat(selectedBooking.security_deposit_amount).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="price-divider"></div>
                  <div className="price-total-row">
                    <span>Total Amount</span>
                    <strong>₹{parseFloat(selectedBooking.total_amount).toLocaleString('en-IN')}</strong>
                  </div>
                </div>

                {/* Payment & DEMO Refund Record */}
                <div className="modal-payment-section">
                  <h5 className="breakdown-title">Payment Information</h5>
                  {selectedBooking.payment_status === 'success' || selectedBooking.booking_status === 'confirmed' ? (
                    <div className="payment-verified-box">
                      <CheckCircle2 size={18} className="verified-icon" />
                      <div>
                        <strong>Paid & Verified via {selectedBooking.payment_method?.toUpperCase() || 'DEMO'}</strong>
                        <p>Txn Ref: {selectedBooking.transaction_reference || 'CONFIRMED'}</p>
                      </div>
                    </div>
                  ) : selectedBooking.booking_status === 'cancelled' ? (
                    <div className="payment-pending-box">
                      <AlertCircle size={18} className="pending-icon" />
                      <div>
                        <strong>Booking Cancelled (Unpaid)</strong>
                        <p>No payment was captured for this booking, so no refund applies.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="payment-pending-box">
                      <Clock size={18} className="pending-icon" />
                      <div>
                        <strong>Payment is Pending</strong>
                        <p>Complete payment before your trip to confirm your booking.</p>
                      </div>
                    </div>
                  )}

                  {selectedBooking.refund_status && (
                    <div className="payment-verified-box" style={{ marginTop: '10px' }}>
                      <RotateCcw size={18} className="verified-icon" />
                      <div>
                        <strong>
                          DEMO Refund ({selectedBooking.refund_status.toUpperCase()}) &bull; ₹{parseFloat(selectedBooking.refund_amount || 0).toLocaleString('en-IN')}
                        </strong>
                        <p>
                          Ref: {selectedBooking.refund_reference || 'DEMO-REF'} &bull; 100% simulated refund (no real money transferred)
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {selectedBooking.cancellation_reason && (
                  <div className="modal-cancel-reason">
                    <strong>Cancellation Reason:</strong>
                    <p>{selectedBooking.cancellation_reason}</p>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                {selectedBooking.booking_status === 'pending' && (
                  <Link
                    to={`/payment/${selectedBooking.id}`}
                    className="btn btn-primary"
                    onClick={() => setSelectedBooking(null)}
                  >
                    <CreditCard size={16} />
                    <span>Pay ₹{parseFloat(selectedBooking.total_amount).toLocaleString('en-IN')}</span>
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedBooking(null)}
                  className="btn btn-secondary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CANCELLATION DIALOG */}
        {cancellingBooking && (
          <div className="modal-backdrop" onClick={() => setCancellingBooking(null)}>
            <div className="cancel-dialog-card" onClick={(e) => e.stopPropagation()}>
              <div className="dialog-header">
                <ShieldAlert size={28} className="dialog-warn-icon" />
                <h3>Cancel Booking?</h3>
                <p>
                  Are you sure you want to cancel booking <strong>{cancellingBooking.booking_reference}</strong>?
                </p>
              </div>

              <div className="dialog-body">
                <label htmlFor="cancelReason">Reason for cancellation (optional):</label>
                <textarea
                  id="cancelReason"
                  rows={3}
                  placeholder="e.g. Change in travel plans, emergency, etc."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="cancel-textarea"
                />
                <p className="cancel-policy-note">
                  {cancellingBooking.payment_status === 'success' || cancellingBooking.booking_status === 'confirmed'
                    ? `* DEMO Refund Policy: Cancelling before scheduled pickup initiates a 100% simulated refund of ₹${parseFloat(cancellingBooking.paid_amount || cancellingBooking.total_amount).toLocaleString('en-IN')} (no real money is transferred).`
                    : '* This booking is unpaid. Cancelling will release the reservation with no refund required.'}
                </p>
              </div>

              <div className="dialog-footer">
                <button
                  type="button"
                  disabled={cancelLoading}
                  onClick={handleConfirmCancel}
                  className="btn btn-danger-action"
                >
                  {cancelLoading ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
                <button
                  type="button"
                  disabled={cancelLoading}
                  onClick={() => setCancellingBooking(null)}
                  className="btn btn-secondary"
                >
                  Keep Booking
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
