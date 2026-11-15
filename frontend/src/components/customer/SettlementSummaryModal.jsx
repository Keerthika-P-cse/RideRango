import { useState, useEffect } from 'react'
import {
  Car,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  X,
  FileCheck2,
  ShieldAlert,
  Coins,
  Receipt,
  UserCheck
} from 'lucide-react'
import api from '../../services/api.js'
import adminApi from '../../services/adminApi.js'
import './SettlementSummaryModal.css'

export default function SettlementSummaryModal({
  isOpen,
  booking,
  onClose,
  isAdminView = false
}) {
  const [settlementData, setSettlementData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!isOpen || !booking?.id) return

    let isMounted = true
    setLoading(true)
    setErrorMsg('')

    const fetchSettlement = isAdminView
      ? adminApi.getAdminSettlement(booking.id)
      : api.getSettlementDetails(booking.id)

    fetchSettlement
      .then((res) => {
        if (!isMounted) return
        if (res && res.success && res.data) {
          setSettlementData(res.data)
        } else {
          setSettlementData(null)
        }
      })
      .catch((err) => {
        if (!isMounted) return
        console.warn('Failed to load settlement details:', err)
        setErrorMsg(err.message || 'Failed to retrieve settlement details.')
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, booking, isAdminView])

  if (!isOpen) return null

  const handlePrint = () => {
    window.print()
  }

  const s = settlementData?.settlement_data || null
  const b = settlementData?.booking || booking || {}

  return (
    <div className="settlement-modal-overlay" onClick={onClose}>
      <div
        className="settlement-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settlement-modal-title"
      >
        {/* Academic Project Demonstration Header Banner */}
        <div className="settlement-academic-banner">
          <span className="academic-badge">COLLEGE DEMO</span>
          <span className="academic-text">
            SAMPLE – COLLEGE PROJECT DEMONSTRATION – NO REAL PAYMENT OR REFUND PROCESSED
          </span>
        </div>

        {/* Modal Header */}
        <div className="settlement-modal-header">
          <div className="settlement-title-group">
            <div className="settlement-icon-pill">
              <FileCheck2 size={24} className="text-emerald" />
            </div>
            <div>
              <h2 id="settlement-modal-title" className="settlement-modal-title">
                Final Rental Settlement Summary
              </h2>
              <p className="settlement-modal-subtitle">
                Rental Closure, Additional Charges & Deposit Refund Statement
              </p>
            </div>
          </div>
          <div className="settlement-header-actions no-print">
            <button
              onClick={handlePrint}
              className="settlement-btn-secondary"
              title="Print Settlement Sheet"
            >
              <Printer size={16} />
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="settlement-btn-close"
              aria-label="Close dialog"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="settlement-modal-body">
          {loading ? (
            <div className="settlement-loading-state">
              <div className="settlement-spinner" />
              <p>Loading final settlement statement...</p>
            </div>
          ) : errorMsg ? (
            <div className="settlement-error-state">
              <AlertCircle size={32} className="text-danger" />
              <h3>Unable to load settlement details</h3>
              <p>{errorMsg}</p>
            </div>
          ) : !s ? (
            <div className="settlement-empty-state">
              <Clock size={36} className="text-amber" />
              <h3>Settlement Pending</h3>
              <p>
                Final settlement has not yet been processed for booking{' '}
                <strong>{b.booking_reference || `#${b.id}`}</strong>. The rental must be returned and inspected first.
              </p>
            </div>
          ) : (
            <div className="settlement-content">
              {/* Meta Status Banner */}
              <div className="settlement-status-card">
                <div className="settlement-status-left">
                  <div className="status-pill-completed">
                    <CheckCircle2 size={16} />
                    <span>Booking Completed & Rental Closed</span>
                  </div>
                  <span className="settlement-ref-badge">
                    Ref: <strong>{b.booking_reference}</strong>
                  </span>
                </div>
                <div className="settlement-status-right">
                  <span className="settlement-date-label">Settled On:</span>
                  <strong>
                    {new Date(s.settled_at).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })}
                  </strong>
                </div>
              </div>

              {/* Rental Details Grid */}
              <div className="settlement-info-grid">
                <div className="settlement-info-card">
                  <div className="card-sub-header">
                    <Car size={16} />
                    <span>Vehicle & Rental Details</span>
                  </div>
                  <div className="card-data-row">
                    <span className="row-label">Vehicle:</span>
                    <span className="row-value font-semibold">
                      {b.vehicle?.make} {b.vehicle?.model}
                    </span>
                  </div>
                  <div className="card-data-row">
                    <span className="row-label">Registration:</span>
                    <span className="row-value reg-plate">
                      {b.vehicle?.registration_number}
                    </span>
                  </div>
                  <div className="card-data-row">
                    <span className="row-label">Rental Duration:</span>
                    <span className="row-value">
                      {b.total_days} {Number(b.total_days) === 1 ? 'day' : 'days'}
                    </span>
                  </div>
                  <div className="card-data-row">
                    <span className="row-label">Customer Name:</span>
                    <span className="row-value">{b.customer_name}</span>
                  </div>
                </div>

                <div className="settlement-info-card">
                  <div className="card-sub-header">
                    <UserCheck size={16} />
                    <span>Inspection & Settlement Audit</span>
                  </div>
                  <div className="card-data-row">
                    <span className="row-label">Settled By:</span>
                    <span className="row-value">{s.settled_by}</span>
                  </div>
                  <div className="card-data-row">
                    <span className="row-label">Distance Travelled:</span>
                    <span className="row-value font-semibold text-emerald">
                      {s.distance_travelled} km
                    </span>
                  </div>
                  <div className="card-data-row">
                    <span className="row-label">Included Allowance:</span>
                    <span className="row-value">
                      {s.included_distance_km} km (150 km/day)
                    </span>
                  </div>
                  <div className="card-data-row">
                    <span className="row-label">Vehicle Condition:</span>
                    <span className={`condition-tag cond-${String(s.vehicle_condition).toLowerCase().replace(/\s+/g, '-')}`}>
                      {s.vehicle_condition}
                    </span>
                  </div>
                </div>
              </div>

              {/* Additional Charges Breakdown Table */}
              <div className="charges-breakdown-section">
                <div className="section-title-cluster">
                  <Receipt size={18} />
                  <h3>Itemized Charges & Demonstration Calculations</h3>
                </div>

                <div className="charges-table-wrapper">
                  <table className="charges-table">
                    <thead>
                      <tr>
                        <th>Charge Item</th>
                        <th>Basis & Formula</th>
                        <th className="text-right">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* 1. Base Rental */}
                      <tr>
                        <td>
                          <strong>Original Rental Fee</strong>
                          <div className="table-sub-detail">Base rental charge for reserved period</div>
                        </td>
                        <td>Scheduled rental duration ({b.total_days} days)</td>
                        <td className="text-right font-semibold">
                          ₹{Number(s.original_rental_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>

                      {/* 2. Extra Mileage */}
                      <tr>
                        <td>
                          <strong>Extra Distance Charge</strong>
                          <div className="table-sub-detail">
                            {s.extra_distance_km > 0
                              ? `${s.extra_distance_km} km exceeded beyond ${s.included_distance_km} km included allowance`
                              : `Within included ${s.included_distance_km} km allowance`}
                          </div>
                        </td>
                        <td>
                          {s.extra_distance_km > 0
                            ? `${s.extra_distance_km} km × ₹12.00/km`
                            : '0 extra km × ₹12/km'}
                        </td>
                        <td className="text-right font-semibold">
                          ₹{Number(s.extra_distance_charge).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>

                      {/* 3. Fuel Refill */}
                      <tr>
                        <td>
                          <strong>Fuel Refill Charge</strong>
                          <div className="table-sub-detail">
                            Returned at {s.ending_fuel_percent}% fuel capacity
                          </div>
                        </td>
                        <td>
                          {s.ending_fuel_percent === 100
                            ? 'Full fuel level – No charge'
                            : `${100 - s.ending_fuel_percent}% missing capacity adjustment`}
                        </td>
                        <td className="text-right font-semibold">
                          ₹{Number(s.fuel_refill_charge).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>

                      {/* 4. Vehicle Damage */}
                      <tr>
                        <td>
                          <strong>Vehicle Damage & Condition</strong>
                          <div className="table-sub-detail">
                            Condition rating: {s.vehicle_condition}
                          </div>
                        </td>
                        <td>
                          {s.damage_charge > 0
                            ? `Standard demo assessment for ${s.vehicle_condition}`
                            : 'Normal wear & tear – ₹0'}
                        </td>
                        <td className="text-right font-semibold">
                          ₹{Number(s.damage_charge).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="charges-summary-row">
                        <td colSpan="2">
                          <strong>Total Additional Charges</strong>
                          <span className="summary-math-hint">
                            (Distance: ₹{s.extra_distance_charge} + Fuel: ₹{s.fuel_refill_charge} + Damage: ₹{s.damage_charge})
                          </span>
                        </td>
                        <td className="text-right total-additional-val">
                          ₹{Number(s.total_additional_charges).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Deposit Settlement & Final Statement Box */}
              <div className="settlement-accounting-card">
                <div className="accounting-header">
                  <Coins size={18} />
                  <h3>Security Deposit & Settlement Reconciliation</h3>
                </div>

                <div className="accounting-math-grid">
                  <div className="math-box">
                    <span className="math-box-lbl">Available Deposit</span>
                    <span className="math-box-val">
                      ₹{Number(s.security_deposit_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="math-box-sub">Original paid security deposit</span>
                  </div>

                  <div className="math-operator">−</div>

                  <div className="math-box deduction-box">
                    <span className="math-box-lbl">Deposit Deduction</span>
                    <span className="math-box-val text-amber">
                      ₹{Number(s.deposit_deduction).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="math-box-sub">Min(Deposit, Total Additional Charges)</span>
                  </div>

                  <div className="math-operator">=</div>

                  <div className="math-box refund-box">
                    <span className="math-box-lbl">Remaining Refund</span>
                    <span className="math-box-val text-emerald">
                      ₹{Number(s.remaining_refund).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="math-box-sub">Demo Refund to Customer Account</span>
                  </div>
                </div>

                {s.remaining_balance > 0 && (
                  <div className="balance-due-alert">
                    <ShieldAlert size={18} />
                    <span>
                      Additional charges exceeded available security deposit. Remaining balance due:{' '}
                      <strong>₹{Number(s.remaining_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </span>
                  </div>
                )}

                <div className="final-rental-total-strip">
                  <span className="strip-label">Final Rental Amount:</span>
                  <span className="strip-calc">
                    ₹{Number(s.original_rental_amount).toLocaleString('en-IN')} (Original) + ₹{Number(s.total_additional_charges).toLocaleString('en-IN')} (Additional Charges)
                  </span>
                  <span className="strip-value">
                    ₹{Number(s.final_rental_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Settlement Remarks if any */}
              {s.settlement_notes && (
                <div className="settlement-remarks-box">
                  <strong>Staff Remarks:</strong>
                  <p>{s.settlement_notes}</p>
                </div>
              )}

              {/* Academic Demonstration Footer Notice */}
              <div className="academic-settlement-footer">
                <p>
                  <strong>Academic Project Demonstration Notice:</strong> This statement represents a simulated rental
                  settlement for the RideRango vehicle rental project. No real bank accounts, UPI payments, or payment
                  gateways were debited or refunded.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="settlement-modal-footer no-print">
          <button onClick={onClose} className="settlement-btn-primary">
            Close Statement
          </button>
        </div>
      </div>
    </div>
  )
}
