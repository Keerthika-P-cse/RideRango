import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  CheckCircle2,
  Eye,
  X,
  AlertCircle,
  MapPin,
  Calendar,
  Clock,
  FileSignature
} from 'lucide-react'
import adminApi from '../../services/adminApi.js'
import VehicleImage from '../../components/common/VehicleImage.jsx'
import RentalAgreementModal from '../../components/customer/RentalAgreementModal.jsx'
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

  // Driving Licence Verification in Booking Modal
  const [bookingDoc, setBookingDoc] = useState(null)
  const [loadingDoc, setLoadingDoc] = useState(false)
  const [docActionLoading, setDocActionLoading] = useState(false)
  const [docActionError, setDocActionError] = useState('')
  const [previewImage, setPreviewImage] = useState(null)

  // Rental Agreement in Booking Modal (Phase 4 Demo)
  const [bookingAgreement, setBookingAgreement] = useState(null)
  const [loadingAgreement, setLoadingAgreement] = useState(false)
  const [generatingAgreement, setGeneratingAgreement] = useState(false)
  const [agreementActionError, setAgreementActionError] = useState('')
  const [viewingAgreementModal, setViewingAgreementModal] = useState(false)

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

  const loadBookingDoc = async (b) => {
    setLoadingDoc(true)
    setDocActionError('')
    try {
      const res = await adminApi.getAdminDocuments()
      if (res && res.success && Array.isArray(res.data)) {
        const found = res.data.find(
          (d) => d.booking_id === b.id || d.booking_reference === b.booking_reference
        )
        setBookingDoc(found || { status: 'not_submitted' })
      } else {
        setBookingDoc({ status: 'not_submitted' })
      }
    } catch {
      setBookingDoc({ status: 'not_submitted' })
    } finally {
      setLoadingDoc(false)
    }
  }

  const handleDocAction = async (action, reason = '') => {
    if (!selectedBooking) return
    setDocActionLoading(true)
    setDocActionError('')
    try {
      const res = await adminApi.verifyAdminDocument(selectedBooking.id, action, reason)
      if (res && res.success) {
        setBookingDoc((prev) => ({
          ...prev,
          status: action === 'accept' ? 'accepted' : 'rejected',
          raw_status: action === 'accept' ? 'verified' : 'rejected',
          rejection_reason: action === 'reject' ? (reason || 'Document image is unclear or invalid.') : null
        }))
      }
    } catch (err) {
      setDocActionError(err.message || `Failed to ${action} document.`)
    } finally {
      setDocActionLoading(false)
    }
  }

  const loadBookingAgreement = async (b) => {
    setLoadingAgreement(true)
    setAgreementActionError('')
    try {
      const res = await adminApi.getAdminAgreement(b.id)
      if (res && res.success && res.data) {
        setBookingAgreement(res.data)
      } else {
        setBookingAgreement({ status: 'not_generated' })
      }
    } catch {
      setBookingAgreement({ status: 'not_generated' })
    } finally {
      setLoadingAgreement(false)
    }
  }

  const handleGenerateAgreement = async () => {
    if (!selectedBooking) return
    setGeneratingAgreement(true)
    setAgreementActionError('')
    try {
      const res = await adminApi.generateAgreement(selectedBooking.id)
      if (res && res.success && res.data) {
        setBookingAgreement(res.data)
        setSuccessMsg(`Rental agreement generated for ${selectedBooking.booking_reference}. Awaiting customer acceptance.`)
      } else {
        setAgreementActionError(res.message || 'Failed to generate agreement.')
      }
    } catch (err) {
      setAgreementActionError(err.message || 'Failed to generate rental agreement.')
    } finally {
      setGeneratingAgreement(false)
    }
  }

  const handleOpenDetailModal = (b) => {
    setSelectedBooking(b)
    setNewStatus(b.booking_status)
    setUpdateError('')
    loadBookingDoc(b)
    loadBookingAgreement(b)
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
                        {b.payment_status === 'success' && (String(b.gateway_transaction_id || '').startsWith('DEMO-') || String(b.payment_notes || '').includes('DEMO PAYMENT')) && (
                          <span className="cell-sub">DEMO PAYMENT (Simulated)</span>
                        )}
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
                    <span>Method: {selectedBooking.payment_method ? selectedBooking.payment_method.toUpperCase() : 'RAZORPAY'}</span>
                  </div>
                  {selectedBooking.payment_status === 'success' && (String(selectedBooking.gateway_transaction_id || '').startsWith('DEMO-') || String(selectedBooking.payment_notes || '').includes('DEMO PAYMENT')) && (
                    <span className="box-val">
                      <strong>DEMO PAYMENT (Simulated)</strong> &bull; No real money transferred
                    </span>
                  )}
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

              {/* Driving Licence Verification Card */}
              <div className="inspect-dl-box">
                <div className="inspect-dl-header">
                  <div className="dl-title-cluster">
                    <span className="box-lbl">Driving Licence Verification</span>
                    <span className="dl-sub-note">Demo document verification for vehicle handover</span>
                  </div>
                  {bookingDoc && (
                    <span className={`doc-status-badge badge-${bookingDoc.status || 'not_submitted'}`}>
                      {bookingDoc.status === 'accepted' ? 'Accepted' :
                       bookingDoc.status === 'rejected' ? 'Rejected' :
                       bookingDoc.status === 'pending' ? 'Pending Review' : 'Not Submitted'}
                    </span>
                  )}
                </div>

                {loadingDoc ? (
                  <p className="dl-empty-note">Checking document submission status...</p>
                ) : !bookingDoc || bookingDoc.status === 'not_submitted' ? (
                  <p className="dl-empty-note">Customer has not uploaded driving licence documents for this reservation yet.</p>
                ) : (
                  <div className="dl-preview-content">
                    <div className="dl-thumbs-row">
                      <div className="dl-thumb-col">
                        <span className="dl-side-label">Front Side</span>
                        {bookingDoc.front_url ? (
                          <div className="dl-img-wrapper" onClick={() => setPreviewImage(bookingDoc.front_url)}>
                            <img src={bookingDoc.front_url} alt="DL Front" className="dl-thumb-img" />
                            <span className="dl-zoom-hint"><Eye size={12} /> View</span>
                          </div>
                        ) : (
                          <div className="dl-missing-thumb">Missing</div>
                        )}
                      </div>

                      <div className="dl-thumb-col">
                        <span className="dl-side-label">Back Side</span>
                        {bookingDoc.back_url ? (
                          <div className="dl-img-wrapper" onClick={() => setPreviewImage(bookingDoc.back_url)}>
                            <img src={bookingDoc.back_url} alt="DL Back" className="dl-thumb-img" />
                            <span className="dl-zoom-hint"><Eye size={12} /> View</span>
                          </div>
                        ) : (
                          <div className="dl-missing-thumb">Missing</div>
                        )}
                      </div>
                    </div>

                    {bookingDoc.rejection_reason && (
                      <div className="dl-reason-note">
                        <strong>Rejection Reason:</strong> {bookingDoc.rejection_reason}
                      </div>
                    )}

                    {docActionError && (
                      <div className="modal-error-box" style={{ marginTop: '8px' }}>
                        <AlertCircle size={14} />
                        <span>{docActionError}</span>
                      </div>
                    )}

                    <div className="dl-actions-row">
                      <button
                        type="button"
                        onClick={() => handleDocAction('accept')}
                        disabled={docActionLoading || bookingDoc.status === 'accepted'}
                        className="btn-doc-accept"
                      >
                        Accept Document
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const r = window.prompt('Enter rejection reason for customer:', 'Image is blurry or expired.')
                          if (r !== null) {
                            handleDocAction('reject', r)
                          }
                        }}
                        disabled={docActionLoading || bookingDoc.status === 'rejected'}
                        className="btn-doc-reject"
                      >
                        Reject Document
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Rental Agreement Section Card (Phase 4 Demo) */}
              <div className="inspect-dl-box inspect-agreement-box">
                <div className="inspect-dl-header">
                  <div className="dl-title-cluster">
                    <span className="box-lbl">Rental Agreement</span>
                    <span className="dl-sub-note">Demo vehicle rental agreement &amp; digital acceptance status</span>
                  </div>
                  {bookingAgreement && (
                    <span className={`doc-status-badge ${
                      bookingAgreement.agreement_status === 'accepted' ? 'badge-accepted' :
                      bookingAgreement.agreement_status === 'pending' ? 'badge-pending' : 'badge-not_submitted'
                    }`}>
                      {bookingAgreement.agreement_status === 'accepted' ? 'Accepted' :
                       bookingAgreement.agreement_status === 'pending' ? 'Pending Customer Acceptance' : 'Not Generated'}
                    </span>
                  )}
                </div>

                {loadingAgreement ? (
                  <p className="dl-empty-note">Loading agreement status...</p>
                ) : !bookingAgreement || bookingAgreement.status === 'not_generated' || !bookingAgreement.agreement_status ? (
                  <div className="agr-admin-panel">
                    <p className="dl-empty-note">
                      No rental agreement has been generated yet for this booking.
                    </p>
                    {['confirmed', 'active', 'completed'].includes(selectedBooking.booking_status) ? (
                      <button
                        type="button"
                        onClick={handleGenerateAgreement}
                        disabled={generatingAgreement}
                        className="btn-generate-agreement"
                      >
                        <FileSignature size={15} />
                        <span>{generatingAgreement ? 'Generating...' : 'Generate Agreement'}</span>
                      </button>
                    ) : (
                      <span className="agr-ineligible-hint">
                        Agreements can only be generated for confirmed bookings.
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="agr-admin-panel">
                    <div className="agr-admin-details">
                      <div>
                        <span className="agr-lbl">Agreement Ref:</span>{' '}
                        <strong>{bookingAgreement.agreement_reference}</strong>
                      </div>
                      {bookingAgreement.agreement_status === 'accepted' ? (
                        <div className="agr-accepted-meta">
                          <CheckCircle2 size={15} />
                          <span>
                            Accepted by customer on{' '}
                            {new Date(bookingAgreement.accepted_at).toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short'
                            })}
                          </span>
                        </div>
                      ) : (
                        <div className="agr-pending-meta">
                          <Clock size={15} />
                          <span>Generated &bull; Awaiting customer acceptance</span>
                        </div>
                      )}
                    </div>

                    <div className="agr-admin-btn-row">
                      <button
                        type="button"
                        onClick={() => setViewingAgreementModal(true)}
                        className="btn-view-agreement"
                      >
                        <Eye size={14} />
                        <span>View Full Agreement</span>
                      </button>
                    </div>
                  </div>
                )}

                {agreementActionError && (
                  <div className="modal-error-box" style={{ marginTop: '8px' }}>
                    <AlertCircle size={14} />
                    <span>{agreementActionError}</span>
                  </div>
                )}
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

      {/* DL IMAGE PREVIEW LIGHTBOX */}
      {previewImage && (
        <div className="modal-backdrop" style={{ zIndex: 1200 }} onClick={() => setPreviewImage(null)}>
          <div className="dl-lightbox-box" onClick={(e) => e.stopPropagation()}>
            <div className="dl-lightbox-bar">
              <span>Driving Licence Preview</span>
              <button type="button" onClick={() => setPreviewImage(null)} className="btn-modal-close">
                <X size={18} />
              </button>
            </div>
            <img src={previewImage} alt="Driving Licence Preview" className="dl-lightbox-img" />
          </div>
        </div>
      )}

      {/* RENTAL AGREEMENT REVIEW MODAL FOR ADMIN */}
      {viewingAgreementModal && selectedBooking && (
        <RentalAgreementModal
          isOpen={viewingAgreementModal}
          booking={selectedBooking}
          onClose={() => setViewingAgreementModal(false)}
          isAdminView={true}
        />
      )}
    </div>
  )
}
