import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  CheckCircle2,
  Eye,
  X,
  AlertCircle,
  MapPin,
  Calendar
} from 'lucide-react'
import adminApi from '../../services/adminApi.js'
import VehicleImage from '../../components/common/VehicleImage.jsx'
import './AdminBookingsPage.css'

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Selected Booking Details / Update Modal
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [newStatus, setNewStatus] = useState('')
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [updateError, setUpdateError] = useState('')

  const loadBookings = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminApi.getBookings({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchTerm.trim() || undefined
      })
      if (res && res.success && res.data) {
        setBookings(res.data)
      }
    } catch (err) {
      setError(err.message || 'Failed to load bookings.')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, searchTerm])

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      loadBookings()
    }, 250)
    return () => clearTimeout(delayDebounce)
  }, [loadBookings])

  const handleOpenDetailModal = (b) => {
    setSelectedBooking(b)
    setNewStatus(b.booking_status)
    setUpdateError('')
  }

  const handleUpdateStatus = async (e) => {
    e.preventDefault()
    if (!selectedBooking || newStatus === selectedBooking.booking_status) return

    setUpdatingStatus(true)
    setUpdateError('')

    try {
      const res = await adminApi.updateBookingStatus(selectedBooking.id, newStatus)
      if (res && res.success) {
        setSuccessMsg(`Booking ${selectedBooking.booking_reference} status updated to ${newStatus}.`)
        setSelectedBooking(null)
        await loadBookings()
      }
    } catch (err) {
      setUpdateError(err.message || 'Failed to update booking status.')
    } finally {
      setUpdatingStatus(false)
    }
  }

  return (
    <div className="admin-bookings-container">
      {/* Header */}
      <div className="bookings-header-row">
        <div>
          <h1 className="dash-title">Manage Bookings</h1>
          <p className="dash-sub">View all customer bookings, check payments and update booking status.</p>
        </div>
      </div>

      {successMsg && (
        <div className="dash-success-banner">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg('')} className="btn-close-banner">&times;</button>
        </div>
      )}

      {error && (
        <div className="dash-error-banner">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bookings-controls-bar">
        <div className="search-input-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by reference, customer name, email or vehicle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button type="button" onClick={() => setSearchTerm('')} className="btn-clear-search">&times;</button>
          )}
        </div>

        <div className="status-tabs-group">
          {['all', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled'].map((st) => (
            <button
              key={st}
              type="button"
              className={`status-tab-btn ${statusFilter === st ? 'active' : ''}`}
              onClick={() => setStatusFilter(st)}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Bookings Table */}
      <div className="dash-section-card">
        <div className="table-responsive">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Customer</th>
                <th>Vehicle</th>
                <th>Rental Dates</th>
                <th>Total / Deposit</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {bookings.length > 0 ? (
                bookings.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <span className="ref-mono">{b.booking_reference}</span>
                      <span className="cell-sub">{new Date(b.created_at).toLocaleDateString('en-IN')}</span>
                    </td>
                    <td>
                      <div className="cell-col">
                        <strong>{b.customer_first_name} {b.customer_last_name}</strong>
                        <span className="cell-sub">{b.customer_phone || b.customer_email}</span>
                      </div>
                    </td>
                    <td>
                      <div className="cell-col">
                        <strong>{b.make} {b.model}</strong>
                        <span className="cell-reg mono">{b.registration_number}</span>
                      </div>
                    </td>
                    <td>
                      <div className="cell-col">
                        <span className="cell-dates">
                          {new Date(b.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} &rarr;{' '}
                          {new Date(b.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        <span className="cell-sub">{b.total_days} {parseFloat(b.total_days) === 1 ? 'Day' : 'Days'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="cell-col">
                        <strong>₹{parseFloat(b.total_amount).toLocaleString('en-IN')}</strong>
                        <span className="cell-sub">Dep: ₹{parseFloat(b.security_deposit || 0).toLocaleString('en-IN')}</span>
                      </div>
                    </td>
                    <td>
                      <div className="cell-col">
                        <span className={`status-pill pill-${b.payment_status === 'success' ? 'confirmed' : 'pending'}`}>
                          {b.payment_status || 'unpaid'}
                        </span>
                        {b.refund_status && (
                          <span className="cell-sub">
                            DEMO Refund: ₹{parseFloat(b.refund_amount || 0).toLocaleString('en-IN')} ({b.refund_status})
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`status-pill pill-${b.booking_status}`}>
                        {b.booking_status}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleOpenDetailModal(b)}
                        className="btn-tbl-action"
                        title="View / Update Booking"
                      >
                        <Eye size={14} />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="empty-table-cell">
                    {loading ? 'Loading reservations...' : 'No reservations found for current criteria.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* BOOKING DETAILS & STATUS UPDATE MODAL */}
      {selectedBooking && (
        <div className="modal-backdrop" onClick={() => setSelectedBooking(null)}>
          <div className="booking-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-ref-tag">Booking Details</span>
                <h3 className="modal-head-title">{selectedBooking.booking_reference}</h3>
              </div>
              <button type="button" onClick={() => setSelectedBooking(null)} className="btn-modal-close">
                <X size={18} />
              </button>
            </div>

            {updateError && (
              <div className="modal-error-box">
                <AlertCircle size={15} />
                <span>{updateError}</span>
              </div>
            )}

            <div className="modal-inspect-body">
              {/* Vehicle & Customer Top Section */}
              <div className="inspect-vehicle-bar">
                <VehicleImage
                  vehicle={selectedBooking}
                  src={selectedBooking.image}
                  alt={`${selectedBooking.make} ${selectedBooking.model}`}
                  className="inspect-veh-img"
                />
                <div className="inspect-veh-info">
                  <span className="sec-cat-label">{selectedBooking.category_name}</span>
                  <h4>{selectedBooking.make} {selectedBooking.model}</h4>
                  <p>Registration: <strong>{selectedBooking.registration_number}</strong></p>
                  <p>Location: {selectedBooking.pickup_location}</p>
                </div>
              </div>

              {/* Customer Profile Box */}
              <div className="inspect-grid-2">
                <div className="inspect-info-box">
                  <span className="box-lbl">Customer Details</span>
                  <strong>{selectedBooking.customer_first_name} {selectedBooking.customer_last_name}</strong>
                  <span className="box-val">{selectedBooking.customer_email}</span>
                  <span className="box-val">{selectedBooking.customer_phone || 'Phone not provided'}</span>
                </div>

                <div className="inspect-info-box">
                  <span className="box-lbl">Payment &amp; DEMO Refund Details</span>
                  <div className="pay-status-row">
                    <span className={`status-pill pill-${selectedBooking.payment_status === 'success' ? 'confirmed' : 'pending'}`}>
                      {selectedBooking.payment_status || 'unpaid'}
                    </span>
                    <span>Method: {selectedBooking.payment_method ? selectedBooking.payment_method.toUpperCase() : 'DEMO'}</span>
                  </div>
                  <span className="box-val">Ref: {selectedBooking.transaction_reference || 'N/A'}</span>
                  <span className="box-val">Total Amount: <strong>₹{parseFloat(selectedBooking.total_amount).toLocaleString('en-IN')}</strong></span>
                  {selectedBooking.refund_status && (
                    <span className="box-val">
                      DEMO Refund: <strong>₹{parseFloat(selectedBooking.refund_amount || 0).toLocaleString('en-IN')}</strong> ({selectedBooking.refund_status}) &bull; {selectedBooking.refund_reference || 'DEMO-REF'} (Simulated — no real money transferred)
                    </span>
                  )}
                  {selectedBooking.cancellation_reason && (
                    <span className="box-val">Cancellation Reason: {selectedBooking.cancellation_reason}</span>
                  )}
                </div>
              </div>

              {/* Dates Itinerary */}
              <div className="inspect-itinerary-box">
                <div className="itin-node">
                  <MapPin size={14} className="itin-icon" />
                  <div>
                    <span className="itin-sub">Pickup Hub</span>
                    <strong>{selectedBooking.pickup_location}</strong>
                    <span className="itin-time">{new Date(selectedBooking.start_date).toLocaleString('en-IN')}</span>
                  </div>
                </div>

                <div className="itin-node">
                  <Calendar size={14} className="itin-icon" />
                  <div>
                    <span className="itin-sub">Return Schedule</span>
                    <strong>{selectedBooking.pickup_location}</strong>
                    <span className="itin-time">{new Date(selectedBooking.end_date).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Status Update Form */}
              <form onSubmit={handleUpdateStatus} className="status-update-form">
                <div className="update-form-field">
                  <label>Update Booking Status:</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="select-status-dropdown"
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="in_progress">In Progress (Vehicle Handed Over)</option>
                    <option value="completed">Completed (Vehicle Returned)</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={updatingStatus || newStatus === selectedBooking.booking_status}
                  className="btn-update-status"
                >
                  {updatingStatus ? 'Updating...' : 'Update Status'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
