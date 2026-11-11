import { Link, useLocation } from 'react-router-dom'
import { Car, Mail, MapPin, Phone } from 'lucide-react'
import { useAuth } from '../../context/useAuth.js'
import { useAdminAuth } from '../../context/useAdminAuth.js'
import './Footer.css'

const CURRENT_YEAR = new Date().getFullYear()

function getPortalLink({
  pathname,
  search,
  isCustomerAuthenticated,
  isStaffAuthenticated,
  isAdmin
}) {
  const searchParams = new URLSearchParams(search)
  const isStaffLoginQuery =
    (pathname === '/login' || pathname === '/auth') &&
    searchParams.get('portal') === 'staff'
  const isStaffOrAdminRoute =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/staff') ||
    isStaffLoginQuery
  const isCustomerPortalRoute =
    pathname.startsWith('/my-bookings') ||
    pathname.startsWith('/booking') ||
    pathname.startsWith('/payment')

  if (isStaffOrAdminRoute) {
    if (isStaffAuthenticated) {
      return {
        label: isAdmin ? 'Admin Portal' : 'Staff Portal',
        to: '/admin'
      }
    }
    return {
      label: 'Staff Portal',
      to: '/login?portal=staff'
    }
  }

  if (isCustomerPortalRoute) {
    return isCustomerAuthenticated
      ? { label: 'Customer Portal', to: '/my-bookings' }
      : { label: 'Customer Login', to: '/login' }
  }

  if (isCustomerAuthenticated) {
    return { label: 'Customer Portal', to: '/my-bookings' }
  }

  if (isStaffAuthenticated) {
    return {
      label: isAdmin ? 'Admin Portal' : 'Staff Portal',
      to: '/admin'
    }
  }

  return { label: 'Portal Login', to: '/login' }
}

export default function Footer() {
  const location = useLocation()
  const { isAuthenticated: isCustomerAuthenticated } = useAuth()
  const { isAuthenticated: isStaffAuthenticated, isAdmin } = useAdminAuth()

  const portalLink = getPortalLink({
    pathname: location.pathname,
    search: location.search,
    isCustomerAuthenticated,
    isStaffAuthenticated,
    isAdmin
  })
  return (
    <footer className="footer-wrapper">
      <div className="footer-container">
        {/* Brand Column */}
        <div className="footer-col footer-col-brand">
          <Link to="/" className="footer-logo">
            <span className="logo-icon-box">
              <Car size={18} />
            </span>
            <span className="logo-text">
              Ride<span className="logo-accent">Rango</span>
            </span>
          </Link>
          <p className="footer-brand-desc">
            Simple, honest and fast vehicle rentals across Bengaluru.
            Book cars, bikes, scooties and utility trucks with zero hidden fees.
          </p>
        </div>

        {/* Categories Column */}
        <div className="footer-col">
          <h4 className="footer-title">Vehicle Types</h4>
          <ul className="footer-list">
            <li>
              <Link to="/vehicles?category=cars">Cars</Link>
            </li>
            <li>
              <Link to="/vehicles?category=bikes">Bikes</Link>
            </li>
            <li>
              <Link to="/vehicles?category=scooties">Scooties</Link>
            </li>
            <li>
              <Link to="/vehicles?category=utility">Utility Vehicles</Link>
            </li>
            <li>
              <Link to="/vehicles">All Available Vehicles</Link>
            </li>
          </ul>
        </div>

        {/* Quick Links Column */}
        <div className="footer-col">
          <h4 className="footer-title">Quick Links</h4>
          <ul className="footer-list">
            <li>
              <Link to="/">Home</Link>
            </li>
            <li>
              <Link to="/vehicles">Explore Vehicles</Link>
            </li>
            <li>
              <Link to="/my-bookings">My Bookings</Link>
            </li>
            <li>
              <Link to="/help">Help & FAQs</Link>
            </li>
            <li>
              <Link to="/terms">Terms and Conditions</Link>
            </li>
            <li>
              <Link to="/privacy">Privacy Policy</Link>
            </li>
          </ul>
        </div>

        {/* Contact Column */}
        <div className="footer-col">
          <h4 className="footer-title">Contact Us</h4>
          <ul className="footer-contact-list">
            <li>
              <Phone size={16} className="contact-icon" />
              <span>+91 98765 43210</span>
            </li>
            <li>
              <Mail size={16} className="contact-icon" />
              <span>support@riderango.com</span>
            </li>
            <li>
              <MapPin size={16} className="contact-icon" />
              <span>Main Hub: 42, 100ft Road, Indiranagar, Bengaluru</span>
            </li>
          </ul>
          <div className="footer-hours">
            <span>Customer Support: Mon &ndash; Sat (8:00 AM &ndash; 8:00 PM)</span>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="footer-bottom-bar">
        <div className="footer-bottom-container">
          <p>&copy; {CURRENT_YEAR} RideRango. All rights reserved.</p>
          <div className="footer-bottom-links">
            <Link to={portalLink.to} className="footer-portal-link">
              {portalLink.label}
            </Link>
          </div>
          <p className="footer-subtext">
            Velocity X Design System &bull; Simple Vehicle Rental Management
          </p>
        </div>
      </div>
    </footer>
  )
}
