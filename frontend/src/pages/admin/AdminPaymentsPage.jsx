import { useState, useEffect } from 'react'
import {
  Search,
  AlertTriangle
} from 'lucide-react'
import adminApi from '../../services/adminApi.js'
import './AdminPaymentsPage.css'

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const loadPayments = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminApi.getPayments()
      if (res && res.success && res.data) {
        setPayments(res.data)
      }
    } catch (err) {
      setError(err.message || 'Failed to load payments.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPayments()
  }, [])

  const filteredPayments = payments.filter((p) => {
    if (statusFilter !== 'all' && p.payment_status !== statusFilter) return false
    if (!search.trim()) return true
    const term = search.toLowerCase()
    const ref = (p.booking_reference || '').toLowerCase()
    const txn = (p.gateway_transaction_id || p.transaction_reference || '').toLowerCase()
    const name = `${p.customer_first_name || ''} ${p.customer_last_name || ''}`.toLowerCase()
    return ref.includes(term) || txn.includes(term) || name.includes(term)
  })

  const totalCaptured = payments
    .filter((p) => p.payment_status === 'success')
    .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0)

  return (
    <div className="admin-payments-container">
      {/* Header */}
      <div className="payments-header-row">
        <div>
          <h1 className="dash-title">Manage Payments</h1>
          <p className="dash-sub">View all customer payments and refund records.</p>
        </div>
        <div className="captured-metric-pill">
          <span className="pill-sub">Total Payments Received:</span>
          <strong>₹{totalCaptured.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
        </div>
      </div>

      {error && (
        <div className="dash-error-banner">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Controls Bar */}
      <div className="payments-controls-bar">
        <div className="search-input-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by payment ID, booking ref or customer name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="btn-clear-search">&times;</button>
          )}
        </div>

        <div className="status-tabs-group">
          {['all', 'success', 'initiated', 'failed', 'refunded'].map((st) => (
            <button
              key={st}
              type="button"
              className={`status-tab-btn ${statusFilter === st ? 'active' : ''}`}
              onClick={() => setStatusFilter(st)}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="dash-section-card">
        <div className="table-responsive">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Booking Ref</th>
                <th>Customer</th>
                <th>Payment ID / Txn Ref</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Payment Status</th>
                <th>Payment Date</th>
                <th>Refund Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length > 0 ? (
                filteredPayments.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span className="ref-mono">{p.booking_reference || 'N/A'}</span>
                    </td>
                    <td>
                      <div className="cell-col">
                        <strong>{p.customer_first_name} {p.customer_last_name}</strong>
                        <span className="cell-sub">{p.customer_email}</span>
                      </div>
                    </td>
                    <td>
                      <div className="cell-col">
                        <span className="mono-txn">
                          {p.gateway_transaction_id || p.transaction_reference}
                        </span>
                        {p.gateway_order_id && (
                          <span className="cell-sub">Order: {p.gateway_order_id}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <strong className="text-white">₹{parseFloat(p.amount).toLocaleString('en-IN')}</strong>
                    </td>
                    <td>
                      <span className="method-tag">
                        {p.payment_type === 'refund'
                          ? 'DEMO REFUND'
                          : (p.payment_method ? p.payment_method.toUpperCase() : 'DEMO')}
                      </span>
                    </td>
                    <td>
                      <span className={`status-pill pill-${p.payment_status === 'success' ? 'confirmed' : (p.payment_status === 'initiated' ? 'pending' : (p.payment_status === 'refunded' ? 'completed' : 'cancelled'))}`}>
                        {p.payment_status}
                      </span>
                    </td>
                    <td>
                      <span className="cell-dates">
                        {p.paid_at
                          ? new Date(p.paid_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : new Date(p.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </td>
                    <td>
                      {p.payment_type === 'refund' ? (
                        <span className={`status-pill pill-${p.payment_status === 'refunded' ? 'completed' : 'pending'}`}>
                          DEMO {p.payment_status === 'refunded' ? 'Refunded (Simulated)' : 'Initiated (Simulated)'}
                        </span>
                      ) : p.payment_status === 'refunded' ? (
                        <span className="status-pill pill-completed">DEMO Refunded (Simulated)</span>
                      ) : (
                        <span className="refund-none">No Refund Requested</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="empty-table-cell">
                    {loading ? 'Loading payment records...' : 'No payment records match the specified criteria.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
