import { useState, useEffect } from 'react'
import {
  Car,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  X,
  Gauge,
  Fuel,
  UserCheck,
  FileText
} from 'lucide-react'
import api from '../../services/api.js'
import adminApi from '../../services/adminApi.js'
import './VehicleHandoverModal.css'

export default function VehicleHandoverModal({
  isOpen,
  booking,
  onClose,
  isAdminView = false
}) {
  const [handoverData, setHandoverData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!isOpen || !booking?.id) return

    let isMounted = true
    setLoading(true)
    setErrorMsg('')

    const fetchHandover = isAdminView
      ? adminApi.getAdminHandover(booking.id)
      : api.getHandoverDetails(booking.id)

    fetchHandover
      .then((res) => {
        if (!isMounted) return
        if (res && res.success && res.data) {
          setHandoverData(res.data)
        } else {
          setHandoverData(null)
        }
      })
      .catch((err) => {
        if (!isMounted) return
        console.warn('Failed to load handover details:', err)
        setErrorMsg(err.message || 'Failed to retrieve handover details.')
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, booking?.id, isAdminView])

  if (!isOpen || !booking) return null

  const handlePrint = () => {
    window.print()
  }

  const h = handoverData?.handover
  const isHandedOver = handoverData?.handed_over && h
  const stageMessage = handoverData?.stage_message || 'Awaiting vehicle dispatch.'

  return (
    <div className="handover-modal-backdrop" onClick={onClose}>
      <div className="handover-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="handover-modal-header">
          <div className="handover-header-titles">
            <div className="handover-title-row">
              <Car size={22} className="handover-header-icon" />
              <h3>Vehicle Handover Record</h3>
              <span
                className={`handover-status-pill ${
                  isHandedOver ? 'pill-completed' : 'pill-pending'
                }`}
              >
                {isHandedOver ? 'Handover Completed' : 'Awaiting Handover'}
              </span>
            </div>
            <p className="handover-booking-ref">
              Booking Ref: <strong>{booking.booking_reference}</strong> &bull; Vehicle Dispatch &amp; Inspection
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="handover-modal-close-btn"
            aria-label="Close vehicle handover modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Academic Demo Disclaimer Banner */}
        <div className="handover-academic-banner">
          <strong>SAMPLE – COLLEGE PROJECT DEMONSTRATION – NOT A LEGAL HANDOVER</strong>
          <span>
            This record simulates vehicle condition and odometer inspection at dispatch for academic evaluation.
          </span>
        </div>

        <div className="handover-modal-body">
          {loading ? (
            <div className="handover-loading-box">
              <Clock size={28} className="animate-spin" />
              <p>Loading vehicle handover details...</p>
            </div>
          ) : errorMsg ? (
            <div className="handover-error-box">
              <AlertCircle size={22} />
              <div>
                <strong>Unable to Load Handover Record</strong>
                <p>{errorMsg}</p>
              </div>
            </div>
          ) : !isHandedOver ? (
            /* AWAITING HANDOVER STATE */
            <div className="handover-pending-state">
              <div className="handover-pending-icon-wrap">
                <Clock size={40} />
              </div>
              <h4>Vehicle Handover Not Yet Completed</h4>
              <p className="handover-stage-msg">{stageMessage}</p>

              <div className="handover-checklist">
                <div className="checklist-item">
                  <div className="checklist-bullet">1</div>
                  <div>
                    <strong>Accept Rental Agreement</strong>
                    <p>
                      {handoverData?.agreement?.status === 'accepted'
                        ? 'Completed: Rental agreement accepted online.'
                        : 'Next Step: Review and accept your rental agreement before arriving at the hub.'}
                    </p>
                  </div>
                </div>

                <div className="checklist-item">
                  <div className="checklist-bullet">2</div>
                  <div>
                    <strong>Driving Licence Verification</strong>
                    <p>Bring your original physical Driving Licence and ID proof to the station for verification.</p>
                  </div>
                </div>

                <div className="checklist-item">
                  <div className="checklist-bullet">3</div>
                  <div>
                    <strong>Vehicle Check &amp; Key Handover</strong>
                    <p>Station staff will verify starting odometer reading and fuel level with you, and hand over the keys.</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* COMPLETED HANDOVER STATE */
            <div className="handover-completed-sheet">
              {/* Success Badge Banner */}
              <div className="handover-success-banner">
                <CheckCircle2 size={24} />
                <div>
                  <strong>Vehicle Dispatched Successfully</strong>
                  <p>
                    Vehicle handover completed on{' '}
                    {new Date(h.handover_datetime).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                    . Rental is now active.
                  </p>
                </div>
              </div>

              {/* Grid: Vehicle & Customer Information */}
              <div className="handover-info-grid">
                <div className="handover-info-card">
                  <span className="card-eyebrow">Vehicle Dispatched</span>
                  <strong className="card-headline">
                    {booking.make || handoverData?.booking?.vehicle?.make}{' '}
                    {booking.model || handoverData?.booking?.vehicle?.model}
                  </strong>
                  <div className="card-meta-line">
                    Registration:{' '}
                    <strong>
                      {booking.registration_number ||
                        handoverData?.booking?.vehicle?.registration_number}
                    </strong>
                  </div>
                  <div className="card-meta-line">
                    Pickup Location: <strong>{booking.pickup_location || 'Hub'}</strong>
                  </div>
                </div>

                <div className="handover-info-card">
                  <span className="card-eyebrow">Hirer / Driver</span>
                  <strong className="card-headline">
                    {handoverData?.booking?.customer_name || 'Customer'}
                  </strong>
                  <div className="card-meta-line">
                    Rental Ref: <strong>{booking.booking_reference}</strong>
                  </div>
                  <div className="card-meta-line">
                    Agreement:{' '}
                    <strong>
                      {handoverData?.agreement?.reference || 'AGR-ACCEPTED'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Handover Inspection Metrics */}
              <div className="handover-metrics-panel">
                <div className="metric-box">
                  <div className="metric-header">
                    <Gauge size={18} />
                    <span>Starting Odometer</span>
                  </div>
                  <div className="metric-value">
                    {Number(h.odometer_reading).toLocaleString('en-IN')}{' '}
                    <span className="metric-unit">km</span>
                  </div>
                  <span className="metric-sub">Recorded at dispatch</span>
                </div>

                <div className="metric-box">
                  <div className="metric-header">
                    <Fuel size={18} />
                    <span>Starting Fuel Level</span>
                  </div>
                  <div className="metric-value">
                    {h.fuel_level_display || `${h.fuel_level_percent}%`}
                  </div>
                  <div className="fuel-meter-bar">
                    <div
                      className="fuel-meter-fill"
                      style={{ width: `${Math.min(100, Math.max(0, h.fuel_level_percent))}%` }}
                    />
                  </div>
                </div>

                <div className="metric-box">
                  <div className="metric-header">
                    <UserCheck size={18} />
                    <span>Dispatched By</span>
                  </div>
                  <div className="metric-value text-compact">
                    {h.recorded_by || 'Fleet Staff'}
                  </div>
                  <span className="metric-sub">RideRango Fleet Team</span>
                </div>
              </div>

              {/* Handover Remarks & Notes */}
              <div className="handover-notes-box">
                <span className="notes-label">Inspection &amp; Handover Remarks</span>
                <p className="notes-content">
                  {h.handover_notes ||
                    'Vehicle inspected in clean condition with no major pre-existing damages noted. All original documents and toolkits verified.'}
                </p>
              </div>

              {/* Audit Confirmation Footer */}
              <div className="handover-audit-tag">
                <FileText size={14} />
                <span>
                  Customer Presence Confirmed &bull; Keys &amp; Vehicle Released &bull; Handover Record #{h.id}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="handover-modal-footer">
          {isHandedOver && (
            <button
              type="button"
              onClick={handlePrint}
              className="btn-handover-print"
            >
              <Printer size={16} />
              <span>Print Handover Sheet</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="btn-handover-close"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
