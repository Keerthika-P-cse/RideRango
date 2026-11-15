import { useState, useEffect } from 'react'
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  X,
  ShieldCheck,
  Info
} from 'lucide-react'
import api from '../../services/api.js'
import adminApi from '../../services/adminApi.js'
import './RentalAgreementModal.css'

export default function RentalAgreementModal({
  isOpen,
  booking,
  onClose,
  onStatusUpdated,
  isAdminView = false
}) {
  const [agreement, setAgreement] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [accepting, setAccepting] = useState(false)
  const [confirmedCheck, setConfirmedCheck] = useState(false)
  const [actionSuccessMsg, setActionSuccessMsg] = useState('')

  useEffect(() => {
    if (!isOpen || !booking?.id) return

    let isMounted = true
    setLoading(true)
    setErrorMsg('')
    setActionSuccessMsg('')
    setConfirmedCheck(false)

    const fetchAgreement = isAdminView
      ? adminApi.getAdminAgreement(booking.id)
      : api.getRentalAgreement(booking.id)

    fetchAgreement
      .then((res) => {
        if (!isMounted) return
        if (res && res.success && res.data) {
          setAgreement(res.data)
        } else {
          setAgreement(null)
        }
      })
      .catch((err) => {
        if (!isMounted) return
        console.warn('Failed to load agreement:', err)
        setErrorMsg(err.message || 'Failed to retrieve agreement details.')
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, booking?.id, isAdminView])

  if (!isOpen || !booking) return null

  const handleAcceptAgreement = async (e) => {
    e.preventDefault()
    if (!agreement?.id) return
    if (!confirmedCheck) {
      setErrorMsg('Please tick the confirmation checkbox to accept the demonstration rental agreement.')
      return
    }

    setAccepting(true)
    setErrorMsg('')
    try {
      const res = await api.acceptRentalAgreement(agreement.id)
      if (res && res.success) {
        setAgreement((prev) => ({
          ...prev,
          agreement_status: 'accepted',
          display_status: 'Accepted',
          accepted_at: res.data?.accepted_at || new Date().toISOString()
        }))
        setActionSuccessMsg('Rental agreement accepted successfully.')
        if (onStatusUpdated) {
          onStatusUpdated('accepted')
        }
      } else {
        setErrorMsg(res.message || 'Failed to accept agreement.')
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to accept agreement. Please try again.')
    } finally {
      setAccepting(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const isAccepted = agreement?.agreement_status === 'accepted'
  const isNotGenerated = !agreement || agreement.status === 'not_generated'

  return (
    <div className="agr-modal-backdrop" onClick={onClose}>
      <div className="agr-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Top Bar */}
        <div className="agr-modal-header">
          <div className="agr-head-title-cluster">
            <span className="agr-head-pill">Demonstration Rental Document</span>
            <h3 className="agr-head-title">Vehicle Rental Agreement</h3>
            <span className="agr-head-sub">
              Booking Ref: <strong>{booking.booking_reference}</strong>
              {agreement?.agreement_reference && (
                <> &bull; Agreement Ref: <strong>{agreement.agreement_reference}</strong></>
              )}
            </span>
          </div>

          <div className="agr-head-actions">
            {!isNotGenerated && (
              <button
                type="button"
                onClick={handlePrint}
                className="agr-btn-print"
                title="Print or save as PDF"
              >
                <Printer size={16} />
                <span>Print</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="agr-btn-close"
              aria-label="Close agreement modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Required Academic Demonstration Notice */}
        <div className="agr-academic-banner">
          <Info size={16} className="agr-banner-icon" />
          <span>SAMPLE &ndash; COLLEGE PROJECT DEMONSTRATION &ndash; NOT A LEGAL CONTRACT</span>
        </div>

        {/* Modal Body */}
        <div className="agr-modal-body">
          {loading ? (
            <div className="agr-state-box">
              <div className="agr-spinner"></div>
              <p>Loading rental agreement records...</p>
            </div>
          ) : errorMsg && !agreement ? (
            <div className="agr-state-box">
              <AlertCircle size={32} color="#ef4444" />
              <p className="agr-error-text">{errorMsg}</p>
            </div>
          ) : isNotGenerated ? (
            <div className="agr-state-box">
              <FileText size={42} color="#64748b" />
              <h4>Agreement Not Generated Yet</h4>
              <p>
                A rental agreement has not yet been generated for reservation{' '}
                <strong>{booking.booking_reference}</strong>.
              </p>
              {isAdminView ? (
                <p className="agr-hint-text">
                  You can generate the agreement using the <strong>Generate Agreement</strong> action in the booking details modal.
                </p>
              ) : (
                <p className="agr-hint-text">
                  Our fleet staff generates the sample rental agreement once your booking is confirmed. Please check back shortly before vehicle handover.
                </p>
              )}
            </div>
          ) : (
            <div className="agr-document-sheet">
              {/* Document Status Ribbon */}
              <div className={`agr-status-ribbon ${isAccepted ? 'status-accepted' : 'status-pending'}`}>
                {isAccepted ? (
                  <>
                    <CheckCircle2 size={18} />
                    <span>Agreement Accepted on {new Date(agreement.accepted_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </>
                ) : (
                  <>
                    <Clock size={18} />
                    <span>Pending Customer Acceptance</span>
                  </>
                )}
              </div>

              {actionSuccessMsg && (
                <div className="agr-alert-success">
                  <CheckCircle2 size={16} />
                  <span>{actionSuccessMsg}</span>
                </div>
              )}

              {errorMsg && (
                <div className="agr-alert-error">
                  <AlertCircle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* 1. Contracting Parties Overview */}
              <div className="agr-section">
                <h4 className="agr-section-title">1. Contracting Parties &amp; Schedule</h4>
                <div className="agr-grid-2">
                  <div className="agr-info-card">
                    <span className="agr-card-lbl">Hirer (Customer)</span>
                    <strong className="agr-card-val">{agreement.customer?.name}</strong>
                    <span className="agr-card-sub">{agreement.customer?.email}</span>
                    <span className="agr-card-sub">{agreement.customer?.phone || 'Phone not registered'}</span>
                    <span className="agr-card-sub">
                      Driving Licence: <strong>{agreement.customer?.driving_license_number || booking.driving_license_number || 'DL-DEMO'}</strong>
                    </span>
                  </div>

                  <div className="agr-info-card">
                    <span className="agr-card-lbl">Vehicle Assigned</span>
                    <strong className="agr-card-val">{agreement.vehicle?.make} {agreement.vehicle?.model} ({agreement.vehicle?.year})</strong>
                    <span className="agr-card-sub">Category: {agreement.vehicle?.category_name || 'Standard'}</span>
                    <span className="agr-card-sub">
                      Registration No: <strong>{agreement.vehicle?.registration_number}</strong>
                    </span>
                  </div>
                </div>

                <div className="agr-schedule-bar">
                  <div className="agr-sched-node">
                    <span className="agr-sched-lbl">Pickup Schedule</span>
                    <strong>{new Date(agreement.rental?.start_date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</strong>
                    <span className="agr-sched-loc">{agreement.rental?.pickup_location}</span>
                  </div>
                  <div className="agr-sched-divider">
                    <span>{agreement.rental?.total_days} Day(s)</span>
                  </div>
                  <div className="agr-sched-node">
                    <span className="agr-sched-lbl">Return Schedule</span>
                    <strong>{new Date(agreement.rental?.end_date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</strong>
                    <span className="agr-sched-loc">{agreement.rental?.dropoff_location}</span>
                  </div>
                </div>
              </div>

              {/* 2. Financial Consideration */}
              <div className="agr-section">
                <h4 className="agr-section-title">2. Rental Charges &amp; Security Deposit</h4>
                <div className="agr-financial-table">
                  <div className="agr-fin-row">
                    <span>Daily Rental Rate ({agreement.rental?.total_days} days &times; ₹{Number(agreement.rental?.rental_rate_per_day).toLocaleString('en-IN')})</span>
                    <span>₹{Number(agreement.rental?.base_rental_amount).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="agr-fin-row">
                    <span>Refundable Security Deposit</span>
                    <span>₹{Number(agreement.rental?.security_deposit_amount).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="agr-fin-row agr-fin-total">
                    <strong>Total Agreed Consideration</strong>
                    <strong>₹{Number(agreement.rental?.total_amount).toLocaleString('en-IN')}</strong>
                  </div>
                </div>
              </div>

              {/* 3. Standard Rental Terms & Responsibilities */}
              <div className="agr-section">
                <h4 className="agr-section-title">3. Terms of Rental &amp; Operational Responsibilities</h4>
                <div className="agr-terms-list">
                  {Array.isArray(agreement.terms_content) && agreement.terms_content.length > 0 ? (
                    agreement.terms_content.map((t, idx) => (
                      <div key={idx} className="agr-term-item">
                        <strong className="agr-term-head">{t.title}</strong>
                        <p className="agr-term-body">{t.clause}</p>
                      </div>
                    ))
                  ) : (
                    <p className="agr-empty-terms">Standard vehicle rental terms apply.</p>
                  )}
                </div>
              </div>

              {/* 4. Acceptance Signature Block */}
              <div className="agr-section agr-acceptance-block">
                <h4 className="agr-section-title">4. Customer Acceptance Confirmation</h4>

                {isAccepted ? (
                  <div className="agr-accepted-box">
                    <div className="agr-sign-badge">
                      <ShieldCheck size={28} className="sign-check-icon" />
                      <div>
                        <strong>DEMONSTRATION ACCEPTANCE RECORDED</strong>
                        <p>
                          Digitally accepted by <strong>{agreement.customer?.name}</strong> on{' '}
                          {new Date(agreement.accepted_at).toLocaleString('en-IN', {
                            dateStyle: 'full',
                            timeStyle: 'medium'
                          })}
                        </p>
                      </div>
                    </div>
                    <span className="agr-academic-tag">College Project Demo Record &bull; Stored in Database</span>
                  </div>
                ) : isAdminView ? (
                  <div className="agr-pending-staff-box">
                    <Clock size={20} />
                    <div>
                      <strong>Awaiting Customer Acceptance</strong>
                      <p>The agreement has been generated and is awaiting customer review and digital confirmation.</p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleAcceptAgreement} className="agr-accept-form">
                    <label className="agr-checkbox-label">
                      <input
                        type="checkbox"
                        checked={confirmedCheck}
                        onChange={(e) => setConfirmedCheck(e.target.checked)}
                        className="agr-checkbox"
                      />
                      <span>
                        I confirm that I have reviewed the vehicle details, rental schedule, charges, and sample terms outlined in this demonstration agreement, and I accept this agreement for vehicle booking <strong>{booking.booking_reference}</strong>.
                      </span>
                    </label>

                    <button
                      type="submit"
                      disabled={accepting || !confirmedCheck}
                      className="agr-btn-accept"
                    >
                      {accepting ? (
                        <>
                          <div className="agr-btn-spinner"></div>
                          <span>Recording Acceptance...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={18} />
                          <span>Accept Rental Agreement</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="agr-modal-footer">
          <button type="button" onClick={onClose} className="agr-btn-dismiss">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
