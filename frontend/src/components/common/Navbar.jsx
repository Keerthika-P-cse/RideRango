import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Car, LogOut, Menu, User, X } from 'lucide-react'
import { useAuth } from '../../context/useAuth.js'
import './Navbar.css'

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen)
  }

  const closeMobileMenu = () => {
    setMobileMenuOpen(false)
  }

  const handleLogout = () => {
    logout()
    closeMobileMenu()
    navigate('/login')
  }

  return (
    <header className="navbar-wrapper">
      <div className="navbar-container">
        {/* Brand Logo */}
        <Link to="/" className="navbar-logo" onClick={closeMobileMenu}>
          <span className="logo-icon-box">
            <Car size={20} className="logo-car-icon" />
          </span>
          <span className="logo-text">
            Ride<span className="logo-accent">Rango</span>
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="navbar-links" aria-label="Main Navigation">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              isActive ? 'nav-item nav-item-active' : 'nav-item'
            }
          >
            Home
          </NavLink>
          <NavLink
            to="/vehicles"
            className={({ isActive }) =>
              isActive ? 'nav-item nav-item-active' : 'nav-item'
            }
          >
            Explore Vehicles
          </NavLink>
          <NavLink
            to="/my-bookings"
            className={({ isActive }) =>
              isActive ? 'nav-item nav-item-active' : 'nav-item'
            }
          >
            My Bookings
          </NavLink>
        </nav>

        {/* User Auth Action */}
        <div className="navbar-actions">
          {isAuthenticated && user ? (
            <div className="navbar-user-group">
              <span className="navbar-user-name" title={user.email}>
                <User size={15} />
                <span>{user.first_name}</span>
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="btn btn-secondary nav-logout-btn"
                title="Logout"
              >
                <LogOut size={14} />
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <Link to="/login" className="btn btn-secondary nav-auth-btn">
              <User size={16} />
              <span>Login / Register</span>
            </Link>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            className="mobile-toggle-btn"
            onClick={toggleMobileMenu}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="mobile-menu-drawer">
          <NavLink
            to="/"
            end
            onClick={closeMobileMenu}
            className={({ isActive }) =>
              isActive
                ? 'mobile-nav-item mobile-nav-active'
                : 'mobile-nav-item'
            }
          >
            Home
          </NavLink>
          <NavLink
            to="/vehicles"
            onClick={closeMobileMenu}
            className={({ isActive }) =>
              isActive
                ? 'mobile-nav-item mobile-nav-active'
                : 'mobile-nav-item'
            }
          >
            Explore Vehicles
          </NavLink>
          <NavLink
            to="/my-bookings"
            onClick={closeMobileMenu}
            className={({ isActive }) =>
              isActive
                ? 'mobile-nav-item mobile-nav-active'
                : 'mobile-nav-item'
            }
          >
            My Bookings
          </NavLink>

          <div className="mobile-auth-wrapper">
            {isAuthenticated && user ? (
              <div className="mobile-user-box">
                <span className="mobile-user-greeting">
                  Signed in as <strong>{user.first_name} {user.last_name}</strong>
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="btn btn-secondary mobile-logout-btn"
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                onClick={closeMobileMenu}
                className="btn btn-primary mobile-auth-btn"
              >
                <User size={16} />
                <span>Login / Register</span>
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
