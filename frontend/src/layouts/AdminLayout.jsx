import { useState } from 'react'
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom'
import {
  LayoutDashboard,
  Car,
  CalendarCheck,
  Users,
  CreditCard,
  UserCog,
  LogOut,
  ExternalLink,
  Shield,
  ShieldAlert,
  Menu,
  X
} from 'lucide-react'
import { useAdminAuth } from '../context/useAdminAuth.js'
import './AdminLayout.css'

export default function AdminLayout() {
  const { adminUser, isAuthenticated, isAdmin, loading, logout } = useAdminAuth()
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  if (loading) {
    return (
      <div className="admin-loading-screen">
        <div className="admin-spinner"></div>
        <p>Verifying credentials...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    navigate('/login?portal=staff', { replace: true })
    return null
  }

  const handleLogout = () => {
    logout()
    navigate('/login?portal=staff', { replace: true })
  }

  const closeMobileMenu = () => {
    setMobileMenuOpen(false)
  }

  return (
    <div className="admin-root-shell">
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div className="admin-sidebar-backdrop" onClick={closeMobileMenu}></div>
      )}

      {/* SIDEBAR */}
      <aside className={`admin-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="admin-brand-section">
          <Link to="/admin" className="admin-brand-logo" onClick={closeMobileMenu}>
            Ride<span className="brand-accent">Rango</span>
          </Link>
          <div className="brand-right-cluster">
            <span className="admin-portal-pill">{isAdmin ? 'Admin' : 'Staff'}</span>
            <button
              type="button"
              onClick={closeMobileMenu}
              className="btn-mobile-sidebar-close"
              aria-label="Close sidebar menu"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Current User Bar */}
        <div className="admin-current-user-card">
          <div className={`user-avatar-badge ${isAdmin ? 'badge-admin' : 'badge-staff'}`}>
            {isAdmin ? <Shield size={16} /> : <ShieldAlert size={16} />}
          </div>
          <div className="user-details-text">
            <span className="user-full-name">{adminUser?.first_name} {adminUser?.last_name}</span>
            <span className={`user-role-tag role-${adminUser?.role}`}>
              {isAdmin ? 'Administrator' : 'Staff'}
            </span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="admin-nav-menu">
          <NavLink
            to="/admin"
            end
            onClick={closeMobileMenu}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/admin/vehicles"
            onClick={closeMobileMenu}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Car size={18} />
            <span>Manage Vehicles</span>
          </NavLink>

          <NavLink
            to="/admin/bookings"
            onClick={closeMobileMenu}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <CalendarCheck size={18} />
            <span>Manage Bookings</span>
          </NavLink>

          <NavLink
            to="/admin/customers"
            onClick={closeMobileMenu}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Users size={18} />
            <span>Manage Customers</span>
          </NavLink>

          <NavLink
            to="/admin/payments"
            onClick={closeMobileMenu}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <CreditCard size={18} />
            <span>Manage Payments</span>
          </NavLink>

          {isAdmin && (
            <NavLink
              to="/admin/staff"
              onClick={closeMobileMenu}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <UserCog size={18} />
              <span>Manage Staff</span>
            </NavLink>
          )}
        </nav>

        {/* Sidebar Footer */}
        <div className="admin-sidebar-footer">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="sidebar-action-btn btn-view-site"
            title="Open customer website in new tab"
          >
            <ExternalLink size={15} />
            <span>View Customer Site</span>
          </a>

          <button
            type="button"
            onClick={handleLogout}
            className="sidebar-action-btn btn-admin-logout"
          >
            <LogOut size={15} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="admin-main-viewport">
        <header className="admin-topbar">
          <div className="topbar-left">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="btn-mobile-menu-trigger"
              aria-label="Open sidebar menu"
            >
              <Menu size={20} />
            </button>
            <div className="topbar-breadcrumb">
              <span className="system-env-tag">{isAdmin ? 'Administrator Portal' : 'Staff Portal'}</span>
            </div>
          </div>

          <div className="topbar-actions">
            <span className="topbar-user-name">
              {adminUser?.first_name ? `${adminUser.first_name} ${adminUser.last_name || ''}`.trim() : (adminUser?.email || 'User')}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="btn-topbar-logout"
              title="Logout from portal"
            >
              <LogOut size={14} />
              <span>Logout</span>
            </button>
          </div>
        </header>

        <section className="admin-content-scroll">
          <Outlet />
        </section>
      </main>
    </div>
  )
}
