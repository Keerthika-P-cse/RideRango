import { useState, useEffect, useMemo } from 'react'
import {
  Search,
  History,
  X,
  AlertCircle,
  Calendar,
  Phone,
  Mail
} from 'lucide-react'
import adminApi from '../../services/adminApi.js'
import VehicleImage from '../../components/common/VehicleImage.jsx'
import './AdminCustomersPage.css'

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  // History modal
  const [selectedHistory, setSelectedHistory] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')

  useEffect(() => {
    let isMounted = true
    adminApi.getCustomers()
      .then((res) => {
        if (!isMounted) return
        if (res && res.success && res.data) {
          setCustomers(res.data)
        }
      })
      .catch((err) => {
        if (isMounted) setError(err.message || 'Failed to load customers.')
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const handleOpenHistory = async (customer) => {
    setSelectedHistory({ customer, bookings: [] })
    setHistoryLoading(true)
    setHistoryError('')

    try {
      const res = await adminApi.getCustomerHistory(customer.id)
      if (res && res.success && res.data) {
        setSelectedHistory(res.data)
      }
    } catch (err) {
      setHistoryError(err.message || 'Failed to load customer booking history.')
    } finally {
      setHistoryLoading(false)
    }
  }

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (!search.trim()) return true
      const term = search.toLowerCase()
      const name = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase()
      const email = (c.email || '').toLowerCase()
      const phone = (c.phone || '').toLowerCase()
      return name.includes(term) || email.includes(term) || phone.includes(term)
    })
  }, [customers, search])

  return (
    <div className="admin-customers-container">
      {/* Header */}
      <div className="customers-header-row">
        <div>
          <h1 className="dash-title">Manage Customers</h1>
          <p className="dash-sub">View registered customers and their booking history.</p>
        </div>
      </div>

      {error && (
        <div className="dash-error-banner">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="customers-controls-bar">
        <div className="search-input-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by customer name, email address or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="btn-clear-search">&times;</button>
          )}
        </div>
        <span className="results-badge">Total Registered: {customers.length}</span>
      </div>

      {/* Table */}
      <div className="dash-section-card">
        <div className="table-responsive">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Customer Name</th>
                <th>Email Address</th>
                <th>Phone Number</th>
                <th>Registration Date</th>
                <th>Total Bookings</th>
                <th>Total Spent</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="cust-name-cell">
                        <div className="cust-avatar-circle">
                          {c.first_name?.[0] || 'U'}
                        </div>
                        <div>
                          <strong>{c.first_name} {c.last_name}</strong>
                          <span className={`status-dot ${c.is_active ? 'dot-active' : 'dot-inactive'}`}>
                            {c.is_active ? 'Active' : 'Suspended'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="cell-sub">{c.email}</span>
                    </td>
                    <td>
                      <span className="cell-sub">{c.phone || 'Not recorded'}</span>
                    </td>
                    <td>
                      <span className="cell-dates">{new Date(c.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    </td>
                    <td>
                      <span className="booking-count-badge">{c.total_bookings}</span>
                    </td>
                    <td>
                      <strong>₹{parseFloat(c.total_spent || 0).toLocaleString('en-IN')}</strong>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleOpenHistory(c)}
                        className="btn-tbl-action"
                        title="View Complete Booking History"
                      >
                        <History size={14} />
                        <span>History</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="empty-table-cell">
                    {loading ? 'Loading customers...' : 'No customers matched your search query.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CUSTOMER HISTORY MODAL */}
      {selectedHistory && (
        <div className="modal-backdrop" onClick={() => setSelectedHistory(null)}>
          <div className="history-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-ref-tag">Customer Profile & History</span>
                <h3 className="modal-head-title">
                  {selectedHistory.customer?.first_name} {selectedHistory.customer?.last_name}
                </h3>
              </div>
              <button type="button" onClick={() => setSelectedHistory(null)} className="btn-modal-close">
                <X size={18} />
              </button>
            </div>

            {historyError && (
              <div className="modal-error-box">
                <AlertCircle size={15} />
                <span>{historyError}</span>
              </div>
            )}

            {/* Profile Overview */}
            <div className="history-profile-overview">
              <div className="profile-mini-item">
                <Mail size={14} className="profile-icon" />
                <span>{selectedHistory.customer?.email}</span>
              </div>
              <div className="profile-mini-item">
                <Phone size={14} className="profile-icon" />
                <span>{selectedHistory.customer?.phone || 'No phone'}</span>
              </div>
              <div className="profile-mini-item">
                <Calendar size={14} className="profile-icon" />
                <span>Member since {new Date(selectedHistory.customer?.created_at).toLocaleDateString('en-IN')}</span>
              </div>
            </div>

            <div className="history-body">
              <h4 className="history-section-title">
                Booking History ({selectedHistory.bookings?.length || 0})
              </h4>

              {historyLoading ? (
                <div className="history-loading-box">
                  <div className="admin-spinner"></div>
                  <p>Loading bookings...</p>
                </div>
              ) : selectedHistory.bookings && selectedHistory.bookings.length > 0 ? (
                <div className="history-bookings-list">
                  {selectedHistory.bookings.map((b) => (
                    <div key={b.id} className="history-booking-item">
                      <VehicleImage
                        vehicle={b}
                        src={b.image}
                        alt={`${b.make} ${b.model}`}
                        className="hist-veh-img"
                      />

                      <div className="hist-meta-col">
                        <div className="hist-top-line">
                          <span className="hist-ref">{b.booking_reference}</span>
                          <span className={`status-pill pill-${b.booking_status}`}>
                            {b.booking_status}
                          </span>
                        </div>

                        <strong className="hist-veh-title">{b.make} {b.model}</strong>

                        <span className="hist-dates">
                          {new Date(b.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} &rarr;{' '}
                          {new Date(b.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>

                      <div className="hist-price-col">
                        <span className="hist-price-val">₹{parseFloat(b.total_amount).toLocaleString('en-IN')}</span>
                        <span className={`status-pill pill-${b.payment_status === 'success' ? 'confirmed' : 'pending'}`}>
                          {b.payment_status || 'unpaid'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-history-text">This customer has not placed any bookings yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
