import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  Car,
  CheckCircle,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Phone,
  Shield,
  ShieldCheck,
  User,
  UserCheck
} from 'lucide-react'
import { useAuth } from '../../context/useAuth.js'
import { useAdminAuth } from '../../context/useAdminAuth.js'
import adminApi from '../../services/adminApi.js'
import './LoginPage.css'

export default function LoginPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const { login: customerLogin, register: customerRegister } = useAuth()
  const { login: staffLogin } = useAdminAuth()

  // Determine initial portal from URL parameter (?portal=staff) or pathname
  const initialPortal = searchParams.get('portal') === 'staff' || window.location.pathname.includes('/admin')
    ? 'staff'
    : 'customer'
  const redirectUrl = searchParams.get('redirect') || '/'

  // Active portal: 'customer' | 'staff'
  const [portal, setPortal] = useState(initialPortal)
  // Customer sub-mode: 'login' | 'register'
  const [customerMode, setCustomerMode] = useState('login')
  // Staff sub-mode: 'login' | 'register'
  const [staffMode, setStaffMode] = useState('login')

  // Password visibility state
  const [showPassword, setShowPassword] = useState(false)

  // Status and feedback
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Form states - strictly empty by default
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Customer registration state
  const [registerData, setRegisterData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: '',
    driving_license_number: '',
    city: 'Bengaluru'
  })

  // Staff registration state
  const [staffRegisterData, setStaffRegisterData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: ''
  })

  // Switch between Customer and Staff portals
  const handlePortalSwitch = (targetPortal) => {
    if (portal === targetPortal) return
    setPortal(targetPortal)
    setCustomerMode('login')
    setStaffMode('login')
    setEmail('') // Always clear inputs on portal switch
    setPassword('') // Always clear password on portal switch
    setError('')
    setSuccessMsg('')
    setShowPassword(false)

    // Update URL query param cleanly without full reload
    const newParams = new URLSearchParams(searchParams)
    if (targetPortal === 'staff') {
      newParams.set('portal', 'staff')
    } else {
      newParams.delete('portal')
    }
    setSearchParams(newParams, { replace: true })
  }

  // Handle Customer & Staff Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    setLoading(true)

    try {
      if (portal === 'customer') {
        await customerLogin(email, password)
        setSuccessMsg('Customer login successful! Redirecting...')
        setTimeout(() => {
          navigate(redirectUrl, { replace: true })
        }, 400)
      } else {
        const staffRes = await staffLogin(email, password)
        setSuccessMsg(`Welcome, ${staffRes?.user?.first_name || 'Staff'}! Directing to Dashboard...`)
        setTimeout(() => {
          // Both admin and fleet_staff navigate to /admin, which adapts view based on verified role
          navigate('/admin', { replace: true })
        }, 400)
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify your credentials.')
    } finally {
      setLoading(false)
    }
  }

  // Handle Customer Registration
  const handleRegisterChange = (e) => {
    const { name, value } = e.target
    setRegisterData((prev) => ({ ...prev, [name]: value }))
  }

  const handleRegisterSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    setLoading(true)

    try {
      await customerRegister(registerData)
      setSuccessMsg('Account created successfully! Redirecting...')
      setTimeout(() => {
        navigate(redirectUrl, { replace: true })
      }, 400)
    } catch (err) {
      setError(err.message || 'Registration failed. Please check your information.')
    } finally {
      setLoading(false)
    }
  }

  // Handle Staff Registration
  const handleStaffRegisterChange = (e) => {
    const { name, value } = e.target
    setStaffRegisterData(prev => ({ ...prev, [name]: value }))
  }

  const handleStaffRegisterSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')
    setLoading(true)

    try {
      const res = await adminApi.registerStaff(staffRegisterData)
      setSuccessMsg(res?.message || 'Staff registration submitted successfully! Your account is pending Administrator approval before you can access the Staff Portal.')
      setStaffMode('login')
      setEmail('')
      setPassword('')
      setStaffRegisterData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        password: ''
      })
    } catch (err) {
      setError(err.message || 'Staff registration failed. Please verify your details.')
    } finally {
      setLoading(false)
    }
  }

  // Quick Demo Account Helpers
  const fillCustomerDemo = () => {
    setEmail('arjun.sharma@example.com')
    setPassword('Password@123')
    setError('')
  }

  const fillStaffDemo = (roleType) => {
    if (roleType === 'admin') {
      setEmail('admin@riderango.com')
      setPassword('Admin@123')
    } else {
      setEmail('rajesh.fleet@riderango.com')
      setPassword('Admin@123')
    }
    setError('')
  }

  return (
    <div className="unified-login-page">
      <div className="unified-login-container">
        {/* Top Back Navigation */}
        <div className="login-back-bar">
          <Link to="/" className="btn-back-link">
            <ArrowLeft size={16} />
            <span>Back to Website</span>
          </Link>
        </div>

        {/* MAIN UNIFIED LOGIN CARD */}
        <div className="unified-login-card">
          {/* Brand Header */}
          <div className="login-brand-header">
            <Link to="/" className="login-logo-link">
              <span className="logo-icon-box">
                <Car size={20} />
              </span>
              <span className="logo-text">
                Ride<span className="logo-accent">Rango</span>
              </span>
            </Link>
            <h1 className="login-main-title">
              {portal === 'customer'
                ? (customerMode === 'register' ? 'Create Customer Account' : 'Welcome Back')
                : (staffMode === 'register' ? 'Staff Portal Registration' : 'Welcome Back')}
            </h1>
            <p className="login-main-subtitle">
              {portal === 'customer'
                ? (customerMode === 'register'
                    ? 'Join RideRango to rent verified cars, bikes, and scooties in Bengaluru.'
                    : 'Sign in to continue to RideRango')
                : (staffMode === 'register'
                    ? 'Submit staff application for Administrator review and account approval.'
                    : 'Sign in to access fleet operations and administrative controls.')}
            </p>
          </div>

          {/* TWO-OPTION PORTAL SWITCH */}
          <div className="portal-switch-wrapper" role="tablist" aria-label="Portal Selection">
            <button
              type="button"
              role="tab"
              aria-selected={portal === 'customer'}
              className={`portal-tab-btn ${portal === 'customer' ? 'active' : ''}`}
              onClick={() => handlePortalSwitch('customer')}
            >
              <User size={16} />
              <span>Customer</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={portal === 'staff'}
              className={`portal-tab-btn ${portal === 'staff' ? 'active' : ''}`}
              onClick={() => handlePortalSwitch('staff')}
            >
              <Shield size={16} />
              <span>Staff</span>
            </button>
          </div>

          {/* Feedback Alerts */}
          {error && (
            <div className="auth-alert alert-error" role="alert">
              <AlertCircle size={18} className="alert-icon" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="auth-alert alert-success" role="status">
              <CheckCircle size={18} className="alert-icon" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* -------------------- 1. CUSTOMER PORTAL -------------------- */}
          {portal === 'customer' && (
            <>
              {customerMode === 'login' ? (
                /* Customer Login Form */
                <form onSubmit={handleLoginSubmit} className="auth-form" autoComplete="off">
                  <div className="form-field">
                    <label htmlFor="customer-email">Email Address</label>
                    <div className="input-box">
                      <Mail size={16} className="input-icon" />
                      <input
                        id="customer-email"
                        name="riderango_login_email"
                        type="email"
                        required
                        placeholder="e.g. arjun.sharma@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                      />
                    </div>
                  </div>

                  <div className="form-field">
                    <label htmlFor="customer-password">Password</label>
                    <div className="input-box">
                      <Lock size={16} className="input-icon" />
                      <input
                        id="customer-password"
                        name="riderango_login_password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="btn-toggle-password"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Customer Quick Demo Account */}
                  <div className="demo-credentials-banner">
                    <div className="demo-text">
                      <strong>Demo Customer:</strong>
                      <span>arjun.sharma@example.com</span>
                    </div>
                    <button
                      type="button"
                      onClick={fillCustomerDemo}
                      className="btn-fill-demo"
                    >
                      Fill Demo
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary auth-submit-btn"
                  >
                    {loading ? 'Signing in...' : 'Sign In as Customer'}
                  </button>

                  <div className="form-bottom-link-row">
                    <span>Don't have an account?</span>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerMode('register')
                        setEmail('')
                        setPassword('')
                        setError('')
                      }}
                      className="btn-text-link"
                    >
                      Register
                    </button>
                  </div>
                </form>
              ) : (
                /* Customer Registration Form */
                <form onSubmit={handleRegisterSubmit} className="auth-form">
                  <div className="form-row-2">
                    <div className="form-field">
                      <label htmlFor="reg-first-name">First Name *</label>
                      <div className="input-box">
                        <User size={16} className="input-icon" />
                        <input
                          id="reg-first-name"
                          name="first_name"
                          type="text"
                          required
                          placeholder="e.g. Priya"
                          value={registerData.first_name}
                          onChange={handleRegisterChange}
                        />
                      </div>
                    </div>

                    <div className="form-field">
                      <label htmlFor="reg-last-name">Last Name *</label>
                      <div className="input-box">
                        <User size={16} className="input-icon" />
                        <input
                          id="reg-last-name"
                          name="last_name"
                          type="text"
                          required
                          placeholder="e.g. Nair"
                          value={registerData.last_name}
                          onChange={handleRegisterChange}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-field">
                    <label htmlFor="reg-email">Email Address *</label>
                    <div className="input-box">
                      <Mail size={16} className="input-icon" />
                      <input
                        id="reg-email"
                        name="email"
                        type="email"
                        required
                        placeholder="name@example.com"
                        value={registerData.email}
                        onChange={handleRegisterChange}
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <div className="form-field">
                    <label htmlFor="reg-phone">Phone Number (+91) *</label>
                    <div className="input-box">
                      <Phone size={16} className="input-icon" />
                      <input
                        id="reg-phone"
                        name="phone"
                        type="tel"
                        required
                        placeholder="+919876543210"
                        value={registerData.phone}
                        onChange={handleRegisterChange}
                        autoComplete="tel"
                      />
                    </div>
                  </div>

                  <div className="form-field">
                    <label htmlFor="reg-password">Password *</label>
                    <div className="input-box">
                      <Lock size={16} className="input-icon" />
                      <input
                        id="reg-password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        placeholder="Create a strong password (min 6 chars)"
                        value={registerData.password}
                        onChange={handleRegisterChange}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="btn-toggle-password"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="form-field">
                    <label htmlFor="reg-license">Driving License Number (Optional)</label>
                    <div className="input-box">
                      <ShieldCheck size={16} className="input-icon" />
                      <input
                        id="reg-license"
                        name="driving_license_number"
                        type="text"
                        placeholder="e.g. KA0120230012345"
                        value={registerData.driving_license_number}
                        onChange={handleRegisterChange}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary auth-submit-btn"
                  >
                    {loading ? 'Creating Account...' : 'Complete Customer Registration'}
                  </button>

                  <div className="form-bottom-link-row">
                    <span>Already have a customer account?</span>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerMode('login')
                        setEmail('')
                        setPassword('')
                        setError('')
                      }}
                      className="btn-text-link"
                    >
                      Sign In
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* -------------------- 2. STAFF / ADMIN PORTAL -------------------- */}
          {portal === 'staff' && (
            <>
              {staffMode === 'login' ? (
                <form onSubmit={handleLoginSubmit} className="auth-form" autoComplete="off">
                  <div className="form-field">
                    <label htmlFor="staff-email">Staff Email Address</label>
                    <div className="input-box">
                      <Mail size={16} className="input-icon" />
                      <input
                        id="staff-email"
                        name="riderango_staff_email"
                        type="email"
                        required
                        placeholder="name@riderango.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                      />
                    </div>
                  </div>

                  <div className="form-field">
                    <label htmlFor="staff-password">Password</label>
                    <div className="input-box">
                      <Lock size={16} className="input-icon" />
                      <input
                        id="staff-password"
                        name="riderango_staff_password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="Enter staff password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="btn-toggle-password"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Quick Staff Demo Credentials */}
                  <div className="staff-demo-box">
                    <span className="staff-demo-title">
                      <KeyRound size={13} />
                      <span>Quick Demo Credentials</span>
                    </span>
                    <div className="staff-demo-buttons">
                      <button
                        type="button"
                        onClick={() => fillStaffDemo('admin')}
                        className="btn-demo-badge admin"
                      >
                        <UserCheck size={12} />
                        <span>Admin (Full Access)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fillStaffDemo('staff')}
                        className="btn-demo-badge staff"
                      >
                        <UserCheck size={12} />
                        <span>Staff</span>
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary auth-submit-btn staff-submit-btn"
                  >
                    {loading ? 'Verifying Credentials...' : 'Sign In to Operations Portal'}
                  </button>

                  <div className="form-bottom-link-row">
                    <span>New staff member?</span>
                    <button
                      type="button"
                      onClick={() => {
                        setStaffMode('register')
                        setEmail('')
                        setPassword('')
                        setError('')
                      }}
                      className="btn-text-link"
                    >
                      Register for Portal Access
                    </button>
                  </div>

                  <p className="staff-note">
                    * Note: Administrator and operational staff access rights are automatically determined based on the verified account role.
                  </p>
                </form>
              ) : (
                /* Staff Registration Form */
                <form onSubmit={handleStaffRegisterSubmit} className="auth-form" autoComplete="off">
                  <div className="form-row-2">
                    <div className="form-field">
                      <label htmlFor="staff-reg-first-name">First Name *</label>
                      <div className="input-box">
                        <User size={16} className="input-icon" />
                        <input
                          id="staff-reg-first-name"
                          name="first_name"
                          type="text"
                          required
                          placeholder="e.g. Anand"
                          value={staffRegisterData.first_name}
                          onChange={handleStaffRegisterChange}
                        />
                      </div>
                    </div>

                    <div className="form-field">
                      <label htmlFor="staff-reg-last-name">Last Name *</label>
                      <div className="input-box">
                        <User size={16} className="input-icon" />
                        <input
                          id="staff-reg-last-name"
                          name="last_name"
                          type="text"
                          required
                          placeholder="e.g. Rao"
                          value={staffRegisterData.last_name}
                          onChange={handleStaffRegisterChange}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-field">
                    <label htmlFor="staff-reg-email">Work Email Address *</label>
                    <div className="input-box">
                      <Mail size={16} className="input-icon" />
                      <input
                        id="staff-reg-email"
                        name="email"
                        type="email"
                        required
                        placeholder="name@riderango.com"
                        value={staffRegisterData.email}
                        onChange={handleStaffRegisterChange}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                      />
                    </div>
                  </div>

                  <div className="form-field">
                    <label htmlFor="staff-reg-phone">Phone Number (+91) *</label>
                    <div className="input-box">
                      <Phone size={16} className="input-icon" />
                      <input
                        id="staff-reg-phone"
                        name="phone"
                        type="tel"
                        required
                        placeholder="+919876543210"
                        value={staffRegisterData.phone}
                        onChange={handleStaffRegisterChange}
                      />
                    </div>
                  </div>

                  <div className="form-field">
                    <label htmlFor="staff-reg-password">Password (min 6 chars) *</label>
                    <div className="input-box">
                      <Lock size={16} className="input-icon" />
                      <input
                        id="staff-reg-password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        placeholder="Create a strong password"
                        value={staffRegisterData.password}
                        onChange={handleStaffRegisterChange}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="btn-toggle-password"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary auth-submit-btn staff-submit-btn"
                  >
                    {loading ? 'Submitting Application...' : 'Submit Staff Registration'}
                  </button>

                  <div className="form-bottom-link-row">
                    <span>Already registered?</span>
                    <button
                      type="button"
                      onClick={() => {
                        setStaffMode('login')
                        setEmail('')
                        setPassword('')
                        setError('')
                      }}
                      className="btn-text-link"
                    >
                      Sign In to Portal
                    </button>
                  </div>

                  <p className="staff-note">
                    * Note: New staff registrations remain in a pending state until reviewed and approved by an Administrator.
                  </p>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
