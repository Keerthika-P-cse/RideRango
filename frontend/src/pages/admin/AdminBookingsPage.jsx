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
  FileSignature,
  Car,
  Gauge,
  Fuel,
  UserCheck,
  CheckSquare,
  RotateCcw,
  Coins,
  Receipt
} from 'lucide-react'
import adminApi from '../../services/adminApi.js'
import VehicleImage from '../../components/common/VehicleImage.jsx'
import RentalAgreementModal from '../../components/customer/RentalAgreementModal.jsx'
import VehicleHandoverModal from '../../components/customer/VehicleHandoverModal.jsx'
import VehicleReturnModal from '../../components/customer/VehicleReturnModal.jsx'
import SettlementSummaryModal from '../../components/customer/SettlementSummaryModal.jsx'
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

  // Vehicle Handover in Booking Modal (Phase 5 Demo)
  const [bookingHandover, setBookingHandover] = useState(null)
  const [loadingHandover, setLoadingHandover] = useState(false)
  const [showHandoverForm, setShowHandoverForm] = useState(false)
  const [handoverOdometer, setHandoverOdometer] = useState('12500')
  const [handoverFuel, setHandoverFuel] = useState('Full')
  const [handoverNotes, setHandoverNotes] = useState('')
  const [handoverSubmitting, setHandoverSubmitting] = useState(false)
  const [handoverError, setHandoverError] = useState('')
  const [viewingHandoverModal, setViewingHandoverModal] = useState(false)

  // Vehicle Return in Booking Modal (Phase 6 Demo)
  const [bookingReturn, setBookingReturn] = useState(null)
  const [loadingReturn, setLoadingReturn] = useState(false)
  const [showReturnForm, setShowReturnForm] = useState(false)
  const [returnOdometer, setReturnOdometer] = useState('')
  const [returnFuel, setReturnFuel] = useState('Full')
  const [returnCondition, setReturnCondition] = useState('Good')
  const [returnNotes, setReturnNotes] = useState('')
  const [returnSubmitting, setReturnSubmitting] = useState(false)
  const [returnError, setReturnError] = useState('')
  const [viewingReturnModal, setViewingReturnModal] = useState(false)

  // Final Settlement in Booking Modal (Phase 7 Demo)
  const [bookingSettlement, setBookingSettlement] = useState(null)
  const [loadingSettlement, setLoadingSettlement] = useState(false)
  const [settlementNotes, setSettlementNotes] = useState('')
  const [settlementSubmitting, setSettlementSubmitting] = useState(false)
  const [settlementError, setSettlementError] = useState('')
  const [viewingSettlementModal, setViewingSettlementModal] = useState(false)
  const [showConfirmSettlementDialog, setShowConfirmSettlementDialog] = useState(false)

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
        await loadBookings()
        setViewingAgreementModal(true)
      } else {
        setAgreementActionError(res.message || 'Failed to generate agreement.')
      }
    } catch (err) {
      setAgreementActionError(err.message || 'Failed to generate rental agreement.')
    } finally {
      setGeneratingAgreement(false)
    }
  }

  const loadBookingHandover = async (b) => {
    setLoadingHandover(true)
    setHandoverError('')
    try {
      const res = await adminApi.getAdminHandover(b.id)
      if (res && res.success && res.data) {
        setBookingHandover(res.data)
      } else {
        setBookingHandover({ handed_over: false })
      }
    } catch {
      setBookingHandover({ handed_over: false })
    } finally {
      setLoadingHandover(false)
    }
  }

  const handleRecordHandover = async (e) => {
    if (e) e.preventDefault()
    if (!selectedBooking) return

    const odo = Number(handoverOdometer)
    if (isNaN(odo) || odo < 0) {
      setHandoverError('Please enter a valid starting odometer reading (0 or greater).')
      return
    }

    setHandoverSubmitting(true)
    setHandoverError('')
    try {
      const res = await adminApi.recordVehicleHandover({
        booking_id: selectedBooking.id,
        odometer_reading: odo,
        fuel_level: handoverFuel,
        handover_notes: handoverNotes
      })

      if (res && res.success) {
        setSuccessMsg(
          `Vehicle handover recorded for ${selectedBooking.booking_reference}. Booking is now ACTIVE and vehicle is RENTED.`
        )
        setSelectedBooking((prev) => ({
          ...prev,
          booking_status: 'active'
        }))
        setShowHandoverForm(false)
        await loadBookingHandover(selectedBooking)
        await loadBookings()
      } else {
        setHandoverError(res.message || 'Failed to record vehicle handover.')
      }
    } catch (err) {
      setHandoverError(err.message || 'Failed to record vehicle handover.')
    } finally {
      setHandoverSubmitting(false)
    }
  }

  const loadBookingReturn = async (b) => {
    setLoadingReturn(true)
    setReturnError('')
    try {
      const res = await adminApi.getAdminVehicleReturn(b.id)
      if (res && res.success && res.data) {
        setBookingReturn(res.data)
      } else {
        setBookingReturn({ returned: false })
      }
    } catch {
      setBookingReturn({ returned: false })
    } finally {
      setLoadingReturn(false)
    }
  }

  const handleRecordReturn = async (e) => {
    if (e) e.preventDefault()
    if (!selectedBooking) return

    const endOdo = Number(returnOdometer)
    const startOdo = bookingHandover?.handover?.odometer_reading
      ? Number(bookingHandover.handover.odometer_reading)
      : 0

    if (isNaN(endOdo) || endOdo < 0) {
      setReturnError('Please enter a valid ending odometer reading (0 or greater).')
      return
    }

    if (endOdo < startOdo) {
      setReturnError(
        `Ending odometer (${endOdo.toLocaleString('en-IN')} km) cannot be less than starting odometer (${startOdo.toLocaleString('en-IN')} km).`
      )
      return
    }

    setReturnSubmitting(true)
    setReturnError('')
    try {
      const res = await adminApi.recordVehicleReturn({
        booking_id: selectedBooking.id,
        odometer_reading: endOdo,
        fuel_level: returnFuel,
        vehicle_condition: returnCondition,
        return_notes: returnNotes
      })

      if (res && res.success) {
        setSuccessMsg(
          `Vehicle return recorded for ${selectedBooking.booking_reference}. Distance: ${res.data?.distance_travelled} km. Pending Phase 7 final settlement.`
        )
        setShowReturnForm(false)
        await loadBookingReturn(selectedBooking)
        await loadBookingSettlement(selectedBooking)
        await loadBookings()
      } else {
        setReturnError(res.message || 'Failed to record vehicle return inspection.')
      }
    } catch (err) {
      setReturnError(err.message || 'Failed to record vehicle return inspection.')
    } finally {
      setReturnSubmitting(false)
    }
  }

  const loadBookingSettlement = async (b) => {
    setLoadingSettlement(true)
    setSettlementError('')
    try {
      const res = await adminApi.previewSettlement(b.id)
      if (res && res.success && res.data) {
        setBookingSettlement(res.data)
      } else {
        setBookingSettlement(null)
      }
    } catch {
      setBookingSettlement(null)
    } finally {
      setLoadingSettlement(false)
    }
  }

  const handleConfirmSettlement = async () => {
    if (!selectedBooking) return
    setSettlementSubmitting(true)
    setSettlementError('')

    try {
      const res = await adminApi.confirmSettlement({
        booking_id: selectedBooking.id,
        settlement_notes: settlementNotes
      })

      if (res && res.success) {
        setSuccessMsg(
          `Final settlement confirmed for ${selectedBooking.booking_reference}. Booking is COMPLETED and vehicle is AVAILABLE.`
        )
        setShowConfirmSettlementDialog(false)
        setSelectedBooking((prev) => ({
          ...prev,
          booking_status: 'completed'
        }))
        await loadBookingSettlement(selectedBooking)
        await loadBookings()
      } else {
        setSettlementError(res?.message || 'Failed to confirm final settlement.')
      }
    } catch (err) {
      setSettlementError(err.message || 'Failed to confirm final settlement.')
    } finally {
      setSettlementSubmitting(false)
    }
  }

  const handleOpenDetailModal = (b) => {
    setSelectedBooking(b)
    setNewStatus(b.booking_status)
    setUpdateError('')
    setShowHandoverForm(false)
    setHandoverError('')
    setHandoverOdometer('12500')
    setHandoverFuel('Full')
    setHandoverNotes('')
    setShowReturnForm(false)
    setReturnError('')
    setReturnOdometer('')
    setReturnFuel('Full')
    setReturnCondition('Good')
    setReturnNotes('')
    setSettlementNotes('')
    setSettlementError('')
    setShowConfirmSettlementDialog(false)
    loadBookingDoc(b)
    loadBookingAgreement(b)
    loadBookingHandover(b)
    loadBookingReturn(b)
    loadBookingSettlement(b)
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
                      <div className="tbl-actions-cell" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenDetailModal(b)}
                          className="btn-tbl-action"
                          title="View / Update Booking"
                        >
                          <Eye size={14} />
                          <span>Inspect</span>
                        </button>
                        {['confirmed', 'active', 'completed'].includes(b.booking_status) && (
                          <button
                            type="button"
                            onClick={() => {
                              handleOpenDetailModal(b)
                              setViewingAgreementModal(true)
                            }}
                            className="btn-tbl-action btn-tbl-agreement"
                            title="View or generate agreement"
                            style={{ background: 'rgba(229, 35, 46, 0.12)', color: '#f87171', border: '1px solid rgba(229, 35, 46, 0.25)' }}
                          >
                            <FileSignature size={14} />
                            <span>Agreement</span>
                          </button>
                        )}
                      </div>
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

              {/* Vehicle Handover Section Card (Phase 5 Demo) */}
              <div className="inspect-dl-box inspect-handover-box">
                <div className="inspect-dl-header">
                  <div className="dl-title-cluster">
                    <span className="box-lbl">Vehicle Handover</span>
                    <span className="dl-sub-note">Fleet vehicle dispatch, starting odometer &amp; fuel verification</span>
                  </div>
                  {bookingHandover && (
                    <span
                      className={`doc-status-badge ${
                        bookingHandover.handed_over
                          ? 'badge-accepted'
                          : bookingAgreement?.agreement_status === 'accepted' &&
                            selectedBooking.booking_status === 'confirmed'
                          ? 'badge-pending'
                          : 'badge-not_submitted'
                      }`}
                    >
                      {bookingHandover.handed_over
                        ? 'Handover Completed'
                        : bookingAgreement?.agreement_status === 'accepted' &&
                          selectedBooking.booking_status === 'confirmed'
                        ? 'Ready for Handover'
                        : bookingAgreement?.agreement_status !== 'accepted'
                        ? 'Agreement Required'
                        : 'Not Applicable'}
                    </span>
                  )}
                </div>

                {loadingHandover ? (
                  <p className="dl-empty-note">Loading handover status...</p>
                ) : bookingHandover?.handed_over && bookingHandover.handover ? (
                  /* ALREADY HANDED OVER */
                  <div className="handover-admin-completed">
                    <div className="handover-completed-summary">
                      <div className="handover-stat-line">
                        <CheckCircle2 size={16} className="text-green" />
                        <span>
                          Dispatched on{' '}
                          <strong>
                            {new Date(bookingHandover.handover.handover_datetime).toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short'
                            })}
                          </strong>
                        </span>
                      </div>
                      <div className="handover-metrics-inline">
                        <div className="h-metric">
                          <Gauge size={14} />
                          <span>
                            Odometer:{' '}
                            <strong>
                              {Number(bookingHandover.handover.odometer_reading).toLocaleString('en-IN')} km
                            </strong>
                          </span>
                        </div>
                        <div className="h-metric">
                          <Fuel size={14} />
                          <span>
                            Fuel: <strong>{bookingHandover.handover.fuel_level_display}</strong>
                          </span>
                        </div>
                        <div className="h-metric">
                          <UserCheck size={14} />
                          <span>
                            By: <strong>{bookingHandover.handover.recorded_by}</strong>
                          </span>
                        </div>
                      </div>
                      {bookingHandover.handover.handover_notes && (
                        <p className="handover-admin-notes">
                          Remarks: <em>{bookingHandover.handover.handover_notes}</em>
                        </p>
                      )}
                    </div>
                    <div className="agr-admin-btn-row">
                      <button
                        type="button"
                        onClick={() => setViewingHandoverModal(true)}
                        className="btn-view-agreement"
                      >
                        <Eye size={14} />
                        <span>View Handover Sheet</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* NOT YET HANDED OVER */
                  <div className="handover-admin-actions">
                    {bookingAgreement?.agreement_status !== 'accepted' ? (
                      <div className="handover-locked-hint">
                        <Clock size={16} />
                        <span>
                          Vehicle handover is locked. Customer must review and accept the rental agreement first.
                        </span>
                      </div>
                    ) : selectedBooking.booking_status !== 'confirmed' ? (
                      <div className="handover-locked-hint">
                        <AlertCircle size={16} />
                        <span>
                          Vehicle handover can only be performed for confirmed bookings (current status:{' '}
                          {selectedBooking.booking_status}).
                        </span>
                      </div>
                    ) : !showHandoverForm ? (
                      <div className="handover-start-wrap">
                        <p className="dl-empty-note">
                          Rental agreement is accepted. Vehicle is ready for odometer/fuel inspection and key handover.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setShowHandoverForm(true)
                            setHandoverError('')
                            if (!handoverOdometer) {
                              setHandoverOdometer('12500')
                            }
                          }}
                          className="btn-start-handover"
                        >
                          <Car size={16} />
                          <span>Start Vehicle Handover</span>
                        </button>
                      </div>
                    ) : (
                      /* HANDOVER FORM */
                      <form onSubmit={handleRecordHandover} className="handover-admin-form">
                        <div className="handover-form-header">
                          <Car size={18} />
                          <strong>Dispatch Vehicle Handover Form</strong>
                        </div>

                        <div className="handover-form-row">
                          <div className="form-field-group">
                            <label>Starting Odometer (km):</label>
                            <input
                              type="number"
                              min="0"
                              value={handoverOdometer}
                              onChange={(e) => setHandoverOdometer(e.target.value)}
                              placeholder="e.g. 14250"
                              required
                              className="handover-input"
                            />
                          </div>

                          <div className="form-field-group">
                            <label>Starting Fuel Level:</label>
                            <select
                              value={handoverFuel}
                              onChange={(e) => setHandoverFuel(e.target.value)}
                              className="handover-select"
                            >
                              <option value="Full">Full (100%)</option>
                              <option value="3/4">¾ (75%)</option>
                              <option value="1/2">½ (50%)</option>
                              <option value="1/4">¼ (25%)</option>
                              <option value="Empty">Empty (0%)</option>
                            </select>
                          </div>
                        </div>

                        <div className="form-field-group full-width">
                          <label>Handover Remarks (Optional):</label>
                          <textarea
                            value={handoverNotes}
                            onChange={(e) => setHandoverNotes(e.target.value)}
                            placeholder="e.g. Clean interior, spare tyre inspected, keys handed to customer."
                            rows={2}
                            className="handover-textarea"
                          />
                        </div>

                        <div className="handover-confirm-notice">
                          <AlertCircle size={14} />
                          <span>
                            Confirming handover will immediately set booking status to <strong>ACTIVE</strong> and
                            vehicle availability to <strong>RENTED</strong>.
                          </span>
                        </div>

                        <div className="handover-form-btn-row">
                          <button
                            type="submit"
                            disabled={handoverSubmitting}
                            className="btn-confirm-handover"
                          >
                            <CheckSquare size={15} />
                            <span>{handoverSubmitting ? 'Recording Handover...' : 'Confirm Handover'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowHandoverForm(false)}
                            disabled={handoverSubmitting}
                            className="btn-cancel-handover"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {handoverError && (
                  <div className="modal-error-box" style={{ marginTop: '8px' }}>
                    <AlertCircle size={14} />
                    <span>{handoverError}</span>
                  </div>
                )}
              </div>

              {/* Vehicle Return & Inspection Section Card (Phase 6 Demo) */}
              <div className="inspect-dl-box inspect-return-box">
                <div className="inspect-dl-header">
                  <div className="dl-title-cluster">
                    <span className="box-lbl">Vehicle Return &amp; Inspection</span>
                    <span className="dl-sub-note">
                      Phase 6: Odometer check, mileage calculation &amp; vehicle condition inspection
                    </span>
                  </div>
                  {bookingReturn && (
                    <span
                      className={`doc-status-badge ${
                        bookingReturn.returned
                          ? 'badge-accepted'
                          : selectedBooking.booking_status === 'active' && bookingHandover?.handed_over
                          ? 'badge-pending'
                          : 'badge-not_submitted'
                      }`}
                    >
                      {bookingReturn.returned
                        ? 'Return Completed / Inspection Pending'
                        : selectedBooking.booking_status === 'active' && bookingHandover?.handed_over
                        ? 'Ready for Return'
                        : 'Awaiting Active Rental'}
                    </span>
                  )}
                </div>

                {loadingReturn ? (
                  <p className="dl-empty-note">Loading return inspection status...</p>
                ) : bookingReturn?.returned && bookingReturn.return_data ? (
                  /* ALREADY RETURNED */
                  <div className="return-admin-completed">
                    <div className="return-completed-summary">
                      <div className="return-stat-line">
                        <CheckCircle2 size={16} className="text-green" />
                        <span>
                          Vehicle returned on{' '}
                          <strong>
                            {new Date(bookingReturn.return_data.return_datetime).toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short'
                            })}
                          </strong>
                        </span>
                      </div>

                      <div className="return-metrics-inline">
                        <div className="r-metric">
                          <Gauge size={14} />
                          <span>
                            Distance:{' '}
                            <strong className="text-distance">
                              {Number(bookingReturn.return_data.distance_travelled).toLocaleString('en-IN')} km
                            </strong>{' '}
                            ({Number(bookingReturn.return_data.starting_odometer).toLocaleString('en-IN')} &rarr;{' '}
                            {Number(bookingReturn.return_data.ending_odometer).toLocaleString('en-IN')} km)
                          </span>
                        </div>

                        <div className="r-metric">
                          <Fuel size={14} />
                          <span>
                            Fuel: <strong>{bookingReturn.return_data.ending_fuel_display}</strong>
                          </span>
                        </div>

                        <div className="r-metric">
                          <span
                            className={`condition-pill ${
                              String(bookingReturn.return_data.vehicle_condition).toLowerCase().includes('damage')
                                ? 'pill-damage'
                                : 'pill-ok'
                            }`}
                          >
                            Condition: {bookingReturn.return_data.vehicle_condition}
                          </span>
                        </div>

                        <div className="r-metric">
                          <UserCheck size={14} />
                          <span>
                            Inspector: <strong>{bookingReturn.return_data.recorded_by}</strong>
                          </span>
                        </div>
                      </div>

                      {bookingReturn.return_data.return_notes && (
                        <p className="return-admin-notes">
                          Remarks: <em>{bookingReturn.return_data.return_notes}</em>
                        </p>
                      )}

                      <div className="return-settlement-tag">
                        <Clock size={13} />
                        <span>Vehicle remains unavailable pending Phase 7 deposit release &amp; rental closure.</span>
                      </div>
                    </div>

                    <div className="agr-admin-btn-row">
                      <button
                        type="button"
                        onClick={() => setViewingReturnModal(true)}
                        className="btn-view-agreement"
                      >
                        <Eye size={14} />
                        <span>View Return Sheet</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* NOT YET RETURNED */
                  <div className="return-admin-actions">
                    {selectedBooking.booking_status !== 'active' ? (
                      <div className="return-locked-hint">
                        <Clock size={16} />
                        <span>
                          Vehicle return inspection is available only for ACTIVE rentals (current:{' '}
                          {selectedBooking.booking_status}).
                        </span>
                      </div>
                    ) : !bookingHandover?.handed_over ? (
                      <div className="return-locked-hint">
                        <AlertCircle size={16} />
                        <span>
                          Vehicle handover must be completed before recording return inspection.
                        </span>
                      </div>
                    ) : !showReturnForm ? (
                      <div className="return-start-wrap">
                        <p className="dl-empty-note">
                          Rental is active. Starting odometer:{' '}
                          <strong>
                            {Number(bookingHandover.handover?.odometer_reading || 0).toLocaleString('en-IN')} km
                          </strong>
                          . Ready to inspect ending odometer and condition.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setShowReturnForm(true)
                            setReturnError('')
                            const startOdo = Number(bookingHandover.handover?.odometer_reading || 0)
                            if (!returnOdometer) {
                              setReturnOdometer(String(startOdo + 180))
                            }
                          }}
                          className="btn-start-return"
                        >
                          <RotateCcw size={16} />
                          <span>Record Vehicle Return</span>
                        </button>
                      </div>
                    ) : (
                      /* RETURN INSPECTION FORM */
                      <form onSubmit={handleRecordReturn} className="return-admin-form">
                        <div className="return-form-header">
                          <RotateCcw size={18} />
                          <strong>Vehicle Return &amp; Inspection Form</strong>
                        </div>

                        <div className="return-form-baseline-tag">
                          <span>
                            Starting Odometer:{' '}
                            <strong>
                              {Number(bookingHandover.handover?.odometer_reading || 0).toLocaleString('en-IN')} km
                            </strong>{' '}
                            &bull; Starting Fuel:{' '}
                            <strong>{bookingHandover.handover?.fuel_level_display || '100%'}</strong>
                          </span>
                        </div>

                        <div className="return-form-row">
                          <div className="form-field-group">
                            <label>Ending Odometer (km):</label>
                            <input
                              type="number"
                              min={Number(bookingHandover.handover?.odometer_reading || 0)}
                              value={returnOdometer}
                              onChange={(e) => setReturnOdometer(e.target.value)}
                              placeholder={`Min: ${Number(bookingHandover.handover?.odometer_reading || 0)}`}
                              required
                              className="return-input"
                            />
                            {returnOdometer &&
                              Number(returnOdometer) >= Number(bookingHandover.handover?.odometer_reading || 0) && (
                                <span className="calc-distance-hint">
                                  Distance: +
                                  {Number(returnOdometer) -
                                    Number(bookingHandover.handover?.odometer_reading || 0)}{' '}
                                  km
                                </span>
                              )}
                          </div>

                          <div className="form-field-group">
                            <label>Ending Fuel Level:</label>
                            <select
                              value={returnFuel}
                              onChange={(e) => setReturnFuel(e.target.value)}
                              className="return-select"
                            >
                              <option value="Full">Full (100%)</option>
                              <option value="3/4">¾ (75%)</option>
                              <option value="1/2">½ (50%)</option>
                              <option value="1/4">¼ (25%)</option>
                              <option value="Empty">Empty (0%)</option>
                            </select>
                          </div>
                        </div>

                        <div className="return-form-row">
                          <div className="form-field-group full-width">
                            <label>Vehicle Condition:</label>
                            <select
                              value={returnCondition}
                              onChange={(e) => setReturnCondition(e.target.value)}
                              className="return-select"
                            >
                              <option value="Excellent">Excellent (No defects, clean interior &amp; exterior)</option>
                              <option value="Good">Good (Normal minor wear, no chargeable damage)</option>
                              <option value="Minor Damage">Minor Damage (Small scratch/dent - Flagged for charges)</option>
                              <option value="Major Damage">Major Damage (Body/engine damage - Escalated review)</option>
                            </select>
                          </div>
                        </div>

                        <div className="form-field-group full-width">
                          <label>Inspection Remarks (Optional):</label>
                          <textarea
                            value={returnNotes}
                            onChange={(e) => setReturnNotes(e.target.value)}
                            placeholder="e.g. Returned clean, toolkit intact, minor scratch noted on rear bumper."
                            rows={2}
                            className="return-textarea"
                          />
                        </div>

                        <div className="return-confirm-notice">
                          <AlertCircle size={14} />
                          <span>
                            Recording return logs vehicle condition and mileage. <strong>Vehicle remains unavailable</strong> until final Phase 7 deposit release and closure.
                          </span>
                        </div>

                        <div className="return-form-btn-row">
                          <button
                            type="submit"
                            disabled={returnSubmitting}
                            className="btn-confirm-return"
                          >
                            <CheckSquare size={15} />
                            <span>{returnSubmitting ? 'Recording Return...' : 'Confirm Return Inspection'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowReturnForm(false)}
                            disabled={returnSubmitting}
                            className="btn-cancel-return"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {returnError && (
                  <div className="modal-error-box" style={{ marginTop: '8px' }}>
                    <AlertCircle size={14} />
                    <span>{returnError}</span>
                  </div>
                )}
              </div>

              {/* Final Settlement & Rental Closure Section Card (Phase 7 Demo) */}
              <div className="inspect-dl-box inspect-settlement-box">
                <div className="inspect-dl-header">
                  <div className="dl-title-cluster">
                    <span className="box-lbl">Final Settlement & Rental Closure</span>
                    <span className="dl-sub-note">
                      Phase 7: Additional charges calculation, deposit reconciliation & closure
                    </span>
                  </div>
                  {bookingSettlement?.is_settled && (
                    <button
                      type="button"
                      onClick={() => setViewingSettlementModal(true)}
                      className="btn-view-settlement-modal"
                      title="View full statement"
                    >
                      <Receipt size={14} />
                      <span>View Statement</span>
                    </button>
                  )}
                </div>

                {loadingSettlement ? (
                  <div className="dl-loading-inline">
                    <Clock size={16} className="spin-slow" />
                    <span>Loading settlement status...</span>
                  </div>
                ) : bookingSettlement?.is_settled ? (
                  /* ALREADY SETTLED VIEW */
                  <div className="handover-completed-cluster">
                    <div className="handover-dispatched-tag">
                      <CheckCircle2 size={16} className="text-green" />
                      <span>
                        Final settlement completed on{' '}
                        <strong>
                          {new Date(bookingSettlement.settlement_record.settled_at).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })}
                        </strong>
                      </span>
                    </div>

                    <div className="settlement-preview-card">
                      <div className="settlement-mini-grid">
                        <div className="settle-stat-card">
                          <span className="settle-stat-lbl">Original Rental</span>
                          <span className="settle-stat-val">
                            ₹{Number(bookingSettlement.settlement_record.original_rental_amount).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="settle-stat-card">
                          <span className="settle-stat-lbl">Extra Distance</span>
                          <span className="settle-stat-val">
                            ₹{Number(bookingSettlement.settlement_record.extra_distance_charge).toLocaleString('en-IN')}
                          </span>
                          <span className="settle-stat-sub">
                            {bookingSettlement.settlement_record.extra_distance_km} km extra
                          </span>
                        </div>
                        <div className="settle-stat-card">
                          <span className="settle-stat-lbl">Fuel Refill</span>
                          <span className="settle-stat-val">
                            ₹{Number(bookingSettlement.settlement_record.fuel_refill_charge).toLocaleString('en-IN')}
                          </span>
                          <span className="settle-stat-sub">
                            {bookingSettlement.settlement_record.ending_fuel_percent}% fuel
                          </span>
                        </div>
                        <div className="settle-stat-card">
                          <span className="settle-stat-lbl">Damage Fee</span>
                          <span className="settle-stat-val">
                            ₹{Number(bookingSettlement.settlement_record.damage_charge).toLocaleString('en-IN')}
                          </span>
                          <span className="settle-stat-sub">
                            {bookingSettlement.settlement_record.vehicle_condition}
                          </span>
                        </div>
                      </div>

                      <div className="settlement-recon-strip">
                        <div>
                          <span className="recon-lbl">Deposit Refund: </span>
                          <span className="recon-calc">
                            (Deposit ₹{Number(bookingSettlement.settlement_record.security_deposit_amount).toLocaleString('en-IN')} − Deducted ₹{Number(bookingSettlement.settlement_record.deposit_deduction).toLocaleString('en-IN')})
                          </span>
                        </div>
                        <span className="recon-val">
                          ₹{Number(bookingSettlement.settlement_record.remaining_refund).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : !bookingReturn?.returned ? (
                  /* RETURN NOT YET COMPLETED */
                  <div className="return-locked-hint">
                    <Clock size={16} />
                    <span>
                      Vehicle return and inspection must be recorded before calculating final charges and rental closure.
                    </span>
                  </div>
                ) : bookingSettlement?.preview ? (
                  /* READY FOR SETTLEMENT */
                  <div className="settlement-ready-cluster">
                    <div className="settlement-preview-card">
                      <div className="settlement-mini-grid">
                        <div className="settle-stat-card">
                          <span className="settle-stat-lbl">Original Rental</span>
                          <span className="settle-stat-val">
                            ₹{Number(bookingSettlement.preview.original_rental_amount).toLocaleString('en-IN')}
                          </span>
                          <span className="settle-stat-sub">Base rental</span>
                        </div>
                        <div className="settle-stat-card">
                          <span className="settle-stat-lbl">Extra Distance</span>
                          <span className="settle-stat-val text-amber">
                            ₹{Number(bookingSettlement.preview.extra_distance_charge).toLocaleString('en-IN')}
                          </span>
                          <span className="settle-stat-sub">
                            {bookingSettlement.preview.extra_distance_km} km @ ₹12/km
                          </span>
                        </div>
                        <div className="settle-stat-card">
                          <span className="settle-stat-lbl">Fuel Refill</span>
                          <span className="settle-stat-val text-amber">
                            ₹{Number(bookingSettlement.preview.fuel_refill_charge).toLocaleString('en-IN')}
                          </span>
                          <span className="settle-stat-sub">
                            {bookingSettlement.preview.ending_fuel_percent}% fuel
                          </span>
                        </div>
                        <div className="settle-stat-card">
                          <span className="settle-stat-lbl">Damage Assessment</span>
                          <span className="settle-stat-val text-amber">
                            ₹{Number(bookingSettlement.preview.damage_charge).toLocaleString('en-IN')}
                          </span>
                          <span className="settle-stat-sub">
                            {bookingSettlement.preview.vehicle_condition}
                          </span>
                        </div>
                      </div>

                      <div className="settlement-recon-strip">
                        <div>
                          <span className="recon-lbl">Deposit Refund Due: </span>
                          <span className="recon-calc">
                            (Deposit ₹{Number(bookingSettlement.preview.security_deposit_amount).toLocaleString('en-IN')} − Deducted ₹{Number(bookingSettlement.preview.deposit_deduction).toLocaleString('en-IN')})
                          </span>
                        </div>
                        <span className="recon-val">
                          ₹{Number(bookingSettlement.preview.remaining_refund).toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div className="return-form-field">
                        <label className="return-label" htmlFor="settlement-admin-notes">
                          Settlement Remarks (Optional):
                        </label>
                        <input
                          id="settlement-admin-notes"
                          type="text"
                          value={settlementNotes}
                          onChange={(e) => setSettlementNotes(e.target.value)}
                          placeholder="e.g. Return inspection verified; deposit refunded in demo mode."
                          className="settlement-notes-input"
                        />
                      </div>

                      <div className="return-form-btn-row">
                        <button
                          type="button"
                          onClick={() => setShowConfirmSettlementDialog(true)}
                          className="btn-confirm-settlement"
                        >
                          <Coins size={15} />
                          <span>Confirm Final Settlement & Close Rental</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="return-locked-hint">
                    <AlertCircle size={16} />
                    <span>Settlement details unavailable for this booking state.</span>
                  </div>
                )}

                {settlementError && (
                  <div className="modal-error-box" style={{ marginTop: '8px' }}>
                    <AlertCircle size={14} />
                    <span>{settlementError}</span>
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
          onStatusUpdated={() => {
            loadBookingAgreement(selectedBooking)
            loadBookings()
          }}
          isAdminView={true}
        />
      )}

      {/* VEHICLE HANDOVER REVIEW MODAL FOR ADMIN */}
      {viewingHandoverModal && selectedBooking && (
        <VehicleHandoverModal
          isOpen={viewingHandoverModal}
          booking={selectedBooking}
          onClose={() => setViewingHandoverModal(false)}
          isAdminView={true}
        />
      )}

      {/* VEHICLE RETURN REVIEW MODAL FOR ADMIN */}
      {viewingReturnModal && selectedBooking && (
        <VehicleReturnModal
          isOpen={viewingReturnModal}
          booking={selectedBooking}
          onClose={() => setViewingReturnModal(false)}
          isAdminView={true}
        />
      )}

      {/* FINAL SETTLEMENT SUMMARY MODAL FOR ADMIN */}
      {viewingSettlementModal && selectedBooking && (
        <SettlementSummaryModal
          isOpen={viewingSettlementModal}
          booking={selectedBooking}
          onClose={() => setViewingSettlementModal(false)}
          isAdminView={true}
        />
      )}

      {/* CONFIRM FINAL SETTLEMENT DIALOG */}
      {showConfirmSettlementDialog && selectedBooking && bookingSettlement?.preview && (
        <div className="settle-dialog-overlay" onClick={() => !settlementSubmitting && setShowConfirmSettlementDialog(false)}>
          <div className="settle-dialog-box" onClick={(e) => e.stopPropagation()}>
            <div className="settle-dialog-header">
              <Coins size={22} className="text-emerald" />
              <h4>Confirm Final Settlement &amp; Rental Closure</h4>
            </div>

            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 1rem 0' }}>
              Are you sure you want to confirm final settlement for booking{' '}
              <strong>{selectedBooking.booking_reference}</strong>? This will complete the booking, reconcile charges against the deposit, and return the vehicle to available status.
            </p>

            <div className="settle-dialog-summary">
              <div className="dialog-row">
                <span>Original Rental Fee:</span>
                <strong>₹{Number(bookingSettlement.preview.original_rental_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div className="dialog-row">
                <span>Total Additional Charges:</span>
                <strong className="text-amber">+₹{Number(bookingSettlement.preview.total_additional_charges).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div className="dialog-row">
                <span>Final Rental Amount:</span>
                <strong style={{ color: '#38bdf8' }}>₹{Number(bookingSettlement.preview.final_rental_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div style={{ height: '1px', background: '#334155', margin: '4px 0' }} />
              <div className="dialog-row">
                <span>Deposit Deduction:</span>
                <span>₹{Number(bookingSettlement.preview.deposit_deduction).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="dialog-row">
                <span>Remaining Deposit Refund:</span>
                <strong className="text-emerald">₹{Number(bookingSettlement.preview.remaining_refund).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
            </div>

            {settlementError && (
              <div className="modal-error-box" style={{ marginBottom: '1rem' }}>
                <AlertCircle size={15} />
                <span>{settlementError}</span>
              </div>
            )}

            <div className="settle-dialog-actions">
              <button
                type="button"
                onClick={() => setShowConfirmSettlementDialog(false)}
                disabled={settlementSubmitting}
                className="btn-cancel-return"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSettlement}
                disabled={settlementSubmitting}
                className="btn-confirm-settlement"
              >
                <CheckCircle2 size={16} />
                <span>{settlementSubmitting ? 'Confirming...' : 'Yes, Confirm & Close Rental'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
