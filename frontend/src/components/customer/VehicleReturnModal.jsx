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
  ShieldCheck,
  AlertTriangle,
  ArrowRight
} from 'lucide-react'
import api from '../../services/api.js'
import adminApi from '../../services/adminApi.js'
import './VehicleReturnModal.css'

export default function VehicleReturnModal({
  isOpen,
  booking,
  onClose,
  isAdminView = false
}) {
  const [returnData, setReturnData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!isOpen || !booking?.id) return

    let isMounted = true
    setLoading(true)
    setErrorMsg('')

    const fetchReturn = isAdminView
      ? adminApi.getAdminVehicleReturn(booking.id)
      : api.getVehicleReturnDetails(booking.id)

    fetchReturn
      .then((res) => {
        if (!isMounted) return
        if (res && res.success && res.data) {
          setReturnData(res.data)
        } else {
          setReturnData(null)
        }
      })
      .catch((err) => {
        if (!isMounted) return
        console.warn('Failed to load return details:', err)
        setErrorMsg(err.message || 'Failed to retrieve vehicle return details.')
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

  const r = returnData?.return_data
  const isReturned = returnData?.returned && r
  const stageMessage = returnData?.stage_message || 'Awaiting vehicle return and inspection.'
  const handover = returnData?.handover

  const getConditionBadgeClass = (condition) => {
    const c = String(condition || '').toLowerCase()
    if (c === 'excellent') return 'condition-excellent'
    if (c === 'good') return 'condition-good'
    if (c.includes('minor')) return 'condition-minor-damage'
    if (c.includes('major')) return 'condition-major-damage'
    return 'condition-default'
  }

  return (
    <div className="return-modal-backdrop" onClick={onClose}>
      <div className="return-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="return-modal-header">
          <div className="return-header-titles">
            <div className="return-title-row">
              <Car size={22} className="return-header-icon" />
              <h3>Vehicle Return &amp; Inspection Record</h3>
              <span
                className={`return-status-pill ${
                  isReturned ? 'pill-return-completed' : 'pill-return-pending'
                }`}
              >
                {isReturned ? 'Return Completed / Inspection Pending' : 'Awaiting Return'}
              </span>
            </div>
            <p className="return-booking-ref">
              Booking Ref: <strong>{booking.booking_reference}</strong> &bull; Phase 6 Vehicle Return Inspection
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="return-modal-close-btn"
            aria-label="Close vehicle return modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Academic Demo Disclaimer Banner */}
        <div className="return-academic-banner">
          <strong>SAMPLE – COLLEGE PROJECT DEMONSTRATION – NOT A LEGAL RETURN INSPECTION</strong>
          <span>
            This record simulates vehicle return inspection and distance calculation for academic evaluation.
          </span>
        </div>

        <div className="return-modal-body">
          {loading ? (
            <div className="return-loading-box">
              <Clock size={28} className="animate-spin" />
              <p>Loading vehicle return inspection details...</p>
            </div>
          ) : errorMsg ? (
            <div className="return-error-box">
              <AlertCircle size={22} />
              <div>
                <strong>Unable to Load Return Record</strong>
                <p>{errorMsg}</p>
              </div>
            </div>
          ) : !isReturned ? (
            /* AWAITING RETURN STATE */
            <div className="return-pending-state">
              <div className="return-pending-icon-wrap">
                <Clock size={40} />
              </div>
              <h4>Vehicle Return Not Yet Completed</h4>
              <p className="return-stage-msg">{stageMessage}</p>

              {handover && (
                <div className="return-handover-ref-box">
                  <span className="ref-box-title">Handover Baseline Data</span>
                  <div className="ref-metrics-grid">
                    <div>
                      <span>Starting Odometer:</span>
                      <strong>{Number(handover.starting_odometer).toLocaleString('en-IN')} km</strong>
                    </div>
                    <div>
                      <span>Starting Fuel Level:</span>
                      <strong>{handover.starting_fuel_display}</strong>
                    </div>
                  </div>
                </div>
              )}

              <div className="return-checklist">
                <div className="return-check-item">
                  <div className="check-bullet">1</div>
                  <div>
                    <strong>Return Vehicle to Designated Hub</strong>
                    <p>Park at {booking.dropoff_location || booking.pickup_location || 'the Hub'}.</p>
                  </div>
                </div>

                <div className="return-check-item">
                  <div className="check-bullet">2</div>
                  <div>
                    <strong>Staff Odometer &amp; Fuel Inspection</strong>
                    <p>Ending odometer reading will be verified to calculate distance travelled.</p>
                  </div>
                </div>

                <div className="return-check-item">
                  <div className="check-bullet">3</div>
                  <div>
                    <strong>Physical Condition Assessment</strong>
                    <p>Fleet staff will inspect exterior, interior, and accessories before final closure.</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* COMPLETED RETURN STATE */
            <div className="return-completed-sheet">
              {/* Success Banner */}
              <div className="return-success-banner">
                <CheckCircle2 size={24} />
                <div>
                  <strong>Vehicle Return &amp; Inspection Completed</strong>
                  <p>
                    Vehicle checked in on{' '}
                    {new Date(r.return_datetime).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                    . Distance and condition logged; pending final settlement.
                  </p>
                </div>
              </div>

              {/* Grid: Vehicle & Customer Info */}
              <div className="return-info-grid">
                <div className="return-info-card">
                  <span className="card-eyebrow">Vehicle Inspected</span>
                  <strong className="card-headline">
                    {booking.make || returnData?.booking?.vehicle?.make}{' '}
                    {booking.model || returnData?.booking?.vehicle?.model}
                  </strong>
                  <div className="card-meta-line">
                    Registration:{' '}
                    <strong>
                      {booking.registration_number ||
                        returnData?.booking?.vehicle?.registration_number}
                    </strong>
                  </div>
                  <div className="card-meta-line">
                    Dropoff Hub: <strong>{booking.dropoff_location || booking.pickup_location || 'Hub'}</strong>
                  </div>
                </div>

                <div className="return-info-card">
                  <span className="card-eyebrow">Hirer / Driver</span>
                  <strong className="card-headline">
                    {returnData?.booking?.customer_name || 'Customer'}
                  </strong>
                  <div className="card-meta-line">
                    Booking Ref: <strong>{booking.booking_reference}</strong>
                  </div>
                  <div className="card-meta-line">
                    Inspector:{' '}
                    <strong>{r.recorded_by || 'Fleet Staff'}</strong>
                  </div>
                </div>
              </div>

              {/* Inspection Odometer & Distance Calculation Panel */}
              <div className="return-odometer-panel">
                <div className="odo-calc-header">
                  <Gauge size={18} />
                  <span>Odometer &amp; Distance Calculation</span>
                </div>

                <div className="odo-flow-row">
                  <div className="odo-step">
                    <span className="odo-step-lbl">Starting Odometer</span>
                    <strong className="odo-step-val">
                      {Number(r.starting_odometer).toLocaleString('en-IN')}{' '}
                      <span className="unit">km</span>
                    </strong>
                    <span className="odo-step-sub">Recorded at handover</span>
                  </div>

                  <div className="odo-arrow">
                    <ArrowRight size={20} />
                  </div>

                  <div className="odo-step">
                    <span className="odo-step-lbl">Ending Odometer</span>
                    <strong className="odo-step-val">
                      {Number(r.ending_odometer).toLocaleString('en-IN')}{' '}
                      <span className="unit">km</span>
                    </strong>
                    <span className="odo-step-sub">Recorded at return</span>
                  </div>

                  <div className="odo-equals">=</div>

                  <div className="odo-step odo-distance-step">
                    <span className="odo-step-lbl">Distance Travelled</span>
                    <strong className="odo-step-val distance-val">
                      {Number(r.distance_travelled).toLocaleString('en-IN')}{' '}
                      <span className="unit">km</span>
                    </strong>
                    <span className="odo-step-sub">Verified total mileage</span>
                  </div>
                </div>
              </div>

              {/* Fuel & Condition Metrics Grid */}
              <div className="return-metrics-panel">
                <div className="return-metric-box">
                  <div className="metric-header">
                    <Fuel size={18} />
                    <span>Ending Fuel Level</span>
                  </div>
                  <div className="metric-value">
                    {r.ending_fuel_display || `${r.ending_fuel_percent}%`}
                  </div>
                  <div className="fuel-meter-bar">
                    <div
                      className="fuel-meter-fill"
                      style={{
                        width: `${Math.min(100, Math.max(0, r.ending_fuel_percent))}%`
                      }}
                    />
                  </div>
                  {r.starting_fuel_display && (
                    <span className="metric-sub">
                      Starting: {r.starting_fuel_display}
                    </span>
                  )}
                </div>

                <div className="return-metric-box">
                  <div className="metric-header">
                    <ShieldCheck size={18} />
                    <span>Vehicle Condition</span>
                  </div>
                  <div className="condition-wrap">
                    <span
                      className={`condition-badge ${getConditionBadgeClass(
                        r.vehicle_condition
                      )}`}
                    >
                      {r.vehicle_condition || 'Good'}
                    </span>
                  </div>
                  <span className="metric-sub">
                    Inspection: {r.inspection_status?.toUpperCase() || 'PASSED'}
                  </span>
                </div>

                <div className="return-metric-box">
                  <div className="metric-header">
                    <UserCheck size={18} />
                    <span>Staff Inspector</span>
                  </div>
                  <div className="metric-value text-compact">
                    {r.recorded_by || 'Fleet Staff'}
                  </div>
                  <span className="metric-sub">RideRango Inspection Team</span>
                </div>
              </div>

              {/* Return Condition Remarks */}
              <div className="return-notes-box">
                <span className="notes-label">Inspection &amp; Condition Remarks</span>
                <p className="notes-content">
                  {r.return_notes ||
                    'Vehicle inspected upon return. No additional issues or unauthorized modifications noted.'}
                </p>
              </div>

              {/* Phase 7 Informational Notice */}
              <div className="return-settlement-notice">
                <AlertTriangle size={18} />
                <div>
                  <strong>Inspection Recorded &bull; Pending Phase 7 Final Settlement</strong>
                  <p>
                    Vehicle condition and mileage are recorded. Vehicle remains unavailable in fleet inventory until final security deposit refund and rental closure are finalized in Phase 7.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="return-modal-footer">
          {isReturned && (
            <button
              type="button"
              onClick={handlePrint}
              className="btn-return-print"
            >
              <Printer size={16} />
              <span>Print Return Sheet</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="btn-return-close"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
