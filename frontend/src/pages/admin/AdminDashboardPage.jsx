import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Car,
  CheckCircle2,
  Clock,
  CreditCard,
  Layers,
  RefreshCw,
  Users,
  CalendarCheck,
  AlertTriangle,
  ArrowRight
} from 'lucide-react'
import adminApi from '../../services/adminApi.js'
import './AdminDashboardPage.css'

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadStats = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminApi.getDashboardStats()
      if (res && res.success && res.data) {
        setStats(res.data)
      } else {
        setError('Failed to load dashboard statistics.')
      }
    } catch (err) {
      setError(err.message || 'Error connecting to analytics service.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  if (loading && !stats) {
    return (
      <div className="admin-page-loading">
        <div className="admin-spinner"></div>
        <p>Loading real-time operations dashboard...</p>
      </div>
    )
  }

  return (
    <div className="dashboard-page-container">
      {/* Top Header */}
      <div className="dash-head-row">
        <div>
          <h1 className="dash-title">Operations Overview</h1>
          <p className="dash-sub">Overview of your vehicles, customer bookings, and payments.</p>
        </div>
        <button type="button" onClick={loadStats} className="btn-dash-refresh" title="Refresh metrics">
          <RefreshCw size={15} className={loading ? 'spinning' : ''} />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {error && (
        <div className="dash-error-banner">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* 10 CORE METRIC CARDS (Requirement 3) */}
      <div className="metrics-grid">
        {/* 1. Total Vehicles */}
        <div className="metric-card">
          <div className="card-top">
            <span className="card-label">Total Vehicles</span>
            <div className="card-icon-box cat-vehicles">
              <Car size={18} />
            </div>
          </div>
          <strong className="card-value">{stats?.totalVehicles ?? '--'}</strong>
          <span className="card-foot">Total registered vehicles</span>
        </div>

        {/* 2. Available Vehicles */}
        <div className="metric-card">
          <div className="card-top">
            <span className="card-label">Available Vehicles</span>
            <div className="card-icon-box cat-green">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <strong className="card-value text-green">{stats?.availableVehicles ?? '--'}</strong>
          <span className="card-foot">Ready for customer booking</span>
        </div>

        {/* 3. Booked Vehicles */}
        <div className="metric-card">
          <div className="card-top">
            <span className="card-label">Booked Vehicles</span>
            <div className="card-icon-box cat-amber">
              <Clock size={18} />
            </div>
          </div>
          <strong className="card-value text-amber">{stats?.bookedVehicles ?? '--'}</strong>
          <span className="card-foot">Currently reserved / on road</span>
        </div>

        {/* 4. Total Customers */}
        <div className="metric-card">
          <div className="card-top">
            <span className="card-label">Total Customers</span>
            <div className="card-icon-box cat-blue">
              <Users size={18} />
            </div>
          </div>
          <strong className="card-value text-blue">{stats?.totalCustomers ?? '--'}</strong>
          <span className="card-foot">Active customer accounts</span>
        </div>

        {/* 5. Total Bookings */}
        <div className="metric-card">
          <div className="card-top">
            <span className="card-label">Total Bookings</span>
            <div className="card-icon-box cat-purple">
              <CalendarCheck size={18} />
            </div>
          </div>
          <strong className="card-value text-purple">{stats?.totalBookings ?? '--'}</strong>
          <span className="card-foot">Total customer bookings</span>
        </div>

        {/* 6. Pending Bookings */}
        <div className="metric-card">
          <div className="card-top">
            <span className="card-label">Pending Bookings</span>
            <div className="card-icon-box cat-amber">
              <Clock size={18} />
            </div>
          </div>
          <strong className="card-value text-amber">{stats?.pendingBookings ?? '--'}</strong>
          <span className="card-foot">Awaiting payment or review</span>
        </div>

        {/* 7. Confirmed Bookings */}
        <div className="metric-card">
          <div className="card-top">
            <span className="card-label">Confirmed Bookings</span>
            <div className="card-icon-box cat-green">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <strong className="card-value text-green">{stats?.confirmedBookings ?? '--'}</strong>
          <span className="card-foot">Payment verified & ready</span>
        </div>

        {/* 8. Completed Bookings */}
        <div className="metric-card">
          <div className="card-top">
            <span className="card-label">Completed Bookings</span>
            <div className="card-icon-box cat-blue">
              <Layers size={18} />
            </div>
          </div>
          <strong className="card-value text-blue">{stats?.completedBookings ?? '--'}</strong>
          <span className="card-foot">Vehicle returned successfully</span>
        </div>

        {/* 9. Total Successful Payments */}
        <div className="metric-card">
          <div className="card-top">
            <span className="card-label">Total Successful Payments</span>
            <div className="card-icon-box cat-green">
              <CreditCard size={18} />
            </div>
          </div>
          <strong className="card-value text-green">{stats?.totalSuccessfulPayments ?? '--'}</strong>
          <span className="card-foot">Successful payments received</span>
        </div>

        {/* 10. Pending Payments */}
        <div className="metric-card">
          <div className="card-top">
            <span className="card-label">Pending Payments</span>
            <div className="card-icon-box cat-red">
              <AlertTriangle size={18} />
            </div>
          </div>
          <strong className="card-value text-red">{stats?.pendingPayments ?? '--'}</strong>
          <span className="card-foot">Initiated checkout orders</span>
        </div>
      </div>

      {/* RECENT BOOKINGS TABLE */}
      <div className="dash-section-card">
        <div className="section-head-row">
          <div>
            <h2 className="sec-heading">Recent Booking Activity</h2>
            <p className="sec-sub">Latest customer bookings submitted to RideRango</p>
          </div>
          <Link to="/admin/bookings" className="btn-sec-link">
            <span>View All Bookings</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="table-responsive">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Customer</th>
                <th>Vehicle</th>
                <th>Duration</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {stats?.recentBookings && stats.recentBookings.length > 0 ? (
                stats.recentBookings.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <span className="ref-mono">{b.booking_reference}</span>
                    </td>
                    <td>
                      <div className="cell-col">
                        <strong>{b.customer_first_name} {b.customer_last_name}</strong>
                        <span className="cell-sub">{b.customer_email}</span>
                      </div>
                    </td>
                    <td>
                      <div className="cell-col">
                        <span>{b.make} {b.model}</span>
                        <span className="cell-reg">{b.registration_number}</span>
                      </div>
                    </td>
                    <td>
                      <span className="cell-dates">
                        {new Date(b.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} &rarr;{' '}
                        {new Date(b.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                      </span>
                    </td>
                    <td>
                      <strong>₹{parseFloat(b.total_amount).toLocaleString('en-IN')}</strong>
                    </td>
                    <td>
                      <span className={`status-pill pill-${b.booking_status}`}>
                        {b.booking_status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="empty-table-cell">No bookings recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
