import { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate, Link, useLocation } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Info,
  MapPin,
  Phone,
  Shield,
  ShieldCheck,
  User
} from 'lucide-react'
import api from '../../services/api.js'
import { useAuth } from '../../context/useAuth.js'
import { getVehicleById as getCatalogVehicle, vehiclesData } from '../../data/vehiclesData.js'
import VehicleImage from '../../components/common/VehicleImage.jsx'
import {
  findMatchingDbUnit,
  getBookingUnavailableReason,
  isStatusBookingBlocked
} from '../../utils/vehicleStatusHelper.js'
import './BookingPage.css'

const dbToCatalogMap = {
  1: 'car-tata-nexon-ev',
  2: 'car-hyundai-creta',
  3: 'bike-yamaha-r15',
  4: 'bike-royal-enfield-hunter-350',
  5: 'scooty-ather-450x',
  6: 'scooty-honda-activa-6g',
  7: 'utility-tata-ace-ev',
  8: 'utility-mahindra-bolero-pikup'
}

const resolveSynchronousVehicle = (param) => {
  if (!param) return null
  const cat = getCatalogVehicle(param)
  if (cat) return { ...cat, make: cat.brand, daily_rate: cat.pricePerDay, security_deposit: cat.securityDeposit }
  const mappedId = dbToCatalogMap[param]
  if (mappedId) {
    const mapped = getCatalogVehicle(mappedId)
    if (mapped) {
      return {
        ...mapped,
        id: parseInt(param, 10),
        make: mapped.brand,
        daily_rate: mapped.pricePerDay,
        security_deposit: mapped.securityDeposit
      }
    }
  }
  // Try finding by name/model
  const matched = vehiclesData.find((v) => v.id.includes(param) || v.name.toLowerCase().includes(param.toLowerCase()))
  if (matched) {
    return { ...matched, make: matched.brand, daily_rate: matched.pricePerDay, security_deposit: matched.securityDeposit }
  }
  return null
}

const getInitialDates = () => {
  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const tomorrow = tomorrowDate.toISOString().split('T')[0]
  const dayAfterDate = new Date(now.getTime() + 48 * 60 * 60 * 1000)
  const dayAfter = dayAfterDate.toISOString().split('T')[0]
  return { today, tomorrow, dayAfter }
}

const { today: DEFAULT_TODAY, tomorrow: DEFAULT_TOMORROW, dayAfter: DEFAULT_DAY_AFTER } = getInitialDates()

export default function BookingPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()

  // 1. URL search context parameters
  const vehicleParam = searchParams.get('vehicleId') || searchParams.get('id') || ''
  const pickupLocationParam = searchParams.get('location') || 'Main Hub - Indiranagar'
  const pickupDateParam = searchParams.get('pickupDate') || ''
  const pickupTimeParam = searchParams.get('pickupTime') || '10:00'
  const returnDateParam = searchParams.get('returnDate') || ''
  const returnTimeParam = searchParams.get('returnTime') || '10:00'

  const initialResolvedVehicle = useMemo(() => resolveSynchronousVehicle(vehicleParam), [vehicleParam])

  const [bookingForm, setBookingForm] = useState(() => ({
    pickupLocation: pickupLocationParam,
    dropoffLocation: pickupLocationParam,
    pickupDate: pickupDateParam || DEFAULT_TOMORROW,
    pickupTime: pickupTimeParam,
    returnDate: returnDateParam || DEFAULT_DAY_AFTER,
    returnTime: returnTimeParam,
    phone: '',
    drivingLicenseNumber: ''
  }))

  const [vehicle, setVehicle] = useState(() => initialResolvedVehicle)
  const [dbVehicles, setDbVehicles] = useState([])
  const [loadingVehicle, setLoadingVehicle] = useState(() => !initialResolvedVehicle)
  const [availability, setAvailability] = useState({ checked: false, available: false, reason: '' })
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // 2. Authentication Protection
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      const fullPath = location.pathname + location.search
      navigate(`/login?redirect=${encodeURIComponent(fullPath)}`, { replace: true })
    }
  }, [authLoading, isAuthenticated, location, navigate])

  const effectivePhone = bookingForm.phone || user?.phone || ''
  const effectiveLicense = bookingForm.drivingLicenseNumber || user?.driving_license_number || ''

  // 3. Load vehicle & fleet records from database smoothly without resetting vehicle state
  useEffect(() => {
    let isMounted = true

    async function loadData() {
      try {
        const dbRes = await api.getVehicles()
        const liveList = (dbRes && dbRes.success && dbRes.data?.vehicles) ? dbRes.data.vehicles : []

        if (!isMounted) return
        setDbVehicles(liveList)

        let selected = null

        // If numeric vehicle ID provided, find directly in database fleet
        if (/^\d+$/.test(vehicleParam)) {
          selected = liveList.find((v) => v.id === parseInt(vehicleParam, 10))
          if (!selected) {
            try {
              const singleRes = await api.getVehicleById(vehicleParam)
              if (singleRes && singleRes.success && singleRes.data) {
                selected = singleRes.data
              }
            } catch {
              // Ignore
            }
          }
        }

        // If not found yet and we have a catalog slug, map to fleet
        if (!selected && vehicleParam) {
          const catalogModel = getCatalogVehicle(vehicleParam)
          if (catalogModel) {
            // Find live unit in database fleet matching this model strictly
            const matchedDb = findMatchingDbUnit(catalogModel, liveList)

            if (matchedDb) {
              selected = {
                ...matchedDb,
                image: catalogModel.image || matchedDb.image,
                description: catalogModel.description
              }
            } else {
              selected = {
                ...catalogModel,
                isCatalogOnly: true
              }
            }
          }
        }

        // Keep already resolved vehicle if liveList doesn't have a better match
        if (selected) {
          setVehicle((prev) => {
            // Preserve stable image reference to prevent re-render flicker
            const finalImage = selected.image || prev?.image || ''
            return { ...prev, ...selected, image: finalImage }
          })
        }
      } catch (err) {
        console.error('Failed to load vehicle for booking:', err)
      } finally {
        if (isMounted) setLoadingVehicle(false)
      }
    }

    loadData()

    return () => {
      isMounted = false
    }
  }, [vehicleParam])

  // 4. Calculate Duration & Pricing
  const startDateTime = `${bookingForm.pickupDate}T${bookingForm.pickupTime}:00`
  const endDateTime = `${bookingForm.returnDate}T${bookingForm.returnTime}:00`

  const rentalCalculation = useMemo(() => {
    if (!bookingForm.pickupDate || !bookingForm.returnDate) {
      return { days: 1, dailyRate: 0, baseAmount: 0, deposit: 0, totalAmount: 0, isValidDates: false }
    }

    const start = new Date(startDateTime)
    const end = new Date(endDateTime)

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return { days: 1, dailyRate: 0, baseAmount: 0, deposit: 0, totalAmount: 0, isValidDates: false }
    }

    const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
    const days = Math.max(1, Math.ceil(diffHours / 24))

    const dailyRate = vehicle
      ? (typeof vehicle.daily_rate === 'number' || typeof vehicle.daily_rate === 'string'
          ? parseFloat(vehicle.daily_rate)
          : parseFloat(vehicle.pricePerDay || 0))
      : 0

    const deposit = vehicle
      ? (typeof vehicle.security_deposit === 'number' || typeof vehicle.security_deposit === 'string'
          ? parseFloat(vehicle.security_deposit)
          : parseFloat(vehicle.securityDeposit || 0))
      : 0

    const baseAmount = dailyRate * days
    const totalAmount = baseAmount + deposit

    return {
      days,
      dailyRate,
      baseAmount,
      deposit,
      totalAmount,
      isValidDates: true
    }
  }, [bookingForm.pickupDate, bookingForm.returnDate, startDateTime, endDateTime, vehicle])

  // 5. Live Vehicle Availability Check
  useEffect(() => {
    let isMounted = true

    async function verifyLiveAvailability() {
      if (!vehicle || vehicle.isCatalogOnly || !vehicle.id || !rentalCalculation.isValidDates) {
        setAvailability({ checked: false, available: false, reason: '' })
        return
      }

      setCheckingAvailability(true)
      try {
        const res = await api.checkAvailability(vehicle.id, startDateTime, endDateTime)
        if (isMounted) {
          if (res && res.success && res.data) {
            setAvailability({
              checked: true,
              available: res.data.available,
              reason: res.data.reason
            })
          }
        }
      } catch (err) {
        if (isMounted) {
          setAvailability({
            checked: true,
            available: false,
            reason: err.message || 'Unable to check availability.'
          })
        }
      } finally {
        if (isMounted) setCheckingAvailability(false)
      }
    }

    const timer = setTimeout(verifyLiveAvailability, 300)
    return () => {
      isMounted = false
      clearTimeout(timer)
    }
  }, [vehicle, startDateTime, endDateTime, rentalCalculation.isValidDates])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setBookingForm((prev) => ({ ...prev, [name]: value }))
    if (submitError) setSubmitError('')
  }

  // Switch to an active vehicle in the database fleet
  const handleSwitchFleetVehicle = (newDbId) => {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('vehicleId', String(newDbId))
    navigate(`/booking?${nextParams.toString()}`)
  }

  const isStatusBlocked = Boolean(
    vehicle && isStatusBookingBlocked(vehicle.availability_status || vehicle.availabilityStatus)
  )
  const statusBlockedReason = getBookingUnavailableReason(
    vehicle?.availability_status || vehicle?.availabilityStatus
  )

  // 6. Handle Booking Submission
  const handleSubmitBooking = async (e) => {
    e.preventDefault()
    setSubmitError('')

    if (!vehicle || vehicle.isCatalogOnly) {
      setSubmitError('Please select a vehicle that is currently active in the database fleet.')
      return
    }

    if (isStatusBlocked) {
      setSubmitError(statusBlockedReason || 'This vehicle is currently unavailable for booking.')
      return
    }

    if (!rentalCalculation.isValidDates) {
      setSubmitError('Please ensure return date and time is after pickup date and time.')
      return
    }

    const finalPhone = effectivePhone.trim()
    const finalLicense = effectiveLicense.trim().toUpperCase()

    if (!finalPhone || finalPhone.length < 10) {
      setSubmitError('Please provide a valid 10-digit mobile number for booking updates.')
      return
    }

    if (!finalLicense || finalLicense.length < 6) {
      setSubmitError('Please provide a valid Driving License Number for vehicle handover.')
      return
    }

    setIsSubmitting(true)

    try {
      const payload = {
        vehicle_id: vehicle.id,
        start_date: startDateTime,
        end_date: endDateTime,
        pickup_location: bookingForm.pickupLocation,
        dropoff_location: bookingForm.dropoffLocation,
        phone: finalPhone,
        driving_license_number: finalLicense
      }

      const res = await api.createBooking(payload)

      if (res && res.success && res.data) {
        navigate(`/payment/${res.data.id}`)
      } else {
        throw new Error(res?.message || 'Failed to create booking.')
      }
    } catch (err) {
      setSubmitError(err.message || 'Booking submission failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (authLoading || (loadingVehicle && !vehicle)) {
    return (
      <div className="booking-page-loading">
        <div className="loading-spinner"></div>
        <p>Loading booking details...</p>
      </div>
    )
  }

  return (
    <div className="booking-page-wrapper">
      <div className="booking-container">
        {/* Top Navigation */}
        <div className="booking-top-nav">
          <Link to="/vehicles" className="btn-back-link">
            <ArrowLeft size={16} />
            <span>Back to Vehicles</span>
          </Link>
          <span className="booking-step-badge">Step 1 of 2: Booking Details</span>
        </div>

        <div className="booking-header">
          <h1 className="booking-title">Complete Your Booking</h1>
          <p className="booking-subtitle">
            Review your trip itinerary, verify customer information, and reserve your ride.
          </p>
        </div>

        {/* Global Error Banner */}
        {submitError && (
          <div className="booking-alert alert-error" role="alert">
            <AlertCircle size={20} className="alert-icon" />
            <div className="alert-content">
              <strong>Booking Notice</strong>
              <p>{submitError}</p>
            </div>
          </div>
        )}

        {/* Catalog Only Warning (Non-Fleet Model) */}
        {vehicle && vehicle.isCatalogOnly && (
          <div className="booking-alert alert-warning" role="alert">
            <Info size={20} className="alert-icon" />
            <div className="alert-content">
              <strong>Vehicle Currently Unavailable</strong>
              <p>
                <strong>{vehicle.name}</strong> is currently not available for immediate booking.
                Please select an available vehicle below to continue:
              </p>
              <div className="fleet-alternatives-grid">
                {dbVehicles.map((dbV) => (
                  <button
                    key={dbV.id}
                    type="button"
                    className="fleet-alt-card"
                    onClick={() => handleSwitchFleetVehicle(dbV.id)}
                  >
                    <strong>{dbV.make} {dbV.model}</strong>
                    <span>₹{parseFloat(dbV.daily_rate).toLocaleString('en-IN')}/day &bull; {dbV.location}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmitBooking} className="booking-layout-grid">
          {/* LEFT COLUMN: Customer & Trip Details Form */}
          <div className="booking-form-column">
            {/* 1. Trip Schedule Card */}
            <div className="booking-card">
              <div className="card-header">
                <Calendar size={18} className="card-header-icon" />
                <h3 className="card-heading">Rental Schedule & Hub</h3>
              </div>

              <div className="card-body">
                <div className="form-group-grid">
                  <div className="form-field full-width">
                    <label htmlFor="pickupLocation">Pickup & Return Hub</label>
                    <div className="input-box">
                      <MapPin size={16} className="input-icon" />
                      <input
                        id="pickupLocation"
                        name="pickupLocation"
                        type="text"
                        required
                        value={bookingForm.pickupLocation}
                        onChange={handleInputChange}
                        placeholder="e.g. Main Hub - Indiranagar"
                      />
                    </div>
                  </div>

                  <div className="form-field">
                    <label htmlFor="pickupDate">Pickup Date</label>
                    <div className="input-box">
                      <Calendar size={16} className="input-icon" />
                      <input
                        id="pickupDate"
                        name="pickupDate"
                        type="date"
                        required
                        min={DEFAULT_TODAY}
                        value={bookingForm.pickupDate}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <div className="form-field">
                    <label htmlFor="pickupTime">Pickup Time</label>
                    <div className="input-box">
                      <Clock size={16} className="input-icon" />
                      <input
                        id="pickupTime"
                        name="pickupTime"
                        type="time"
                        required
                        value={bookingForm.pickupTime}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <div className="form-field">
                    <label htmlFor="returnDate">Return Date</label>
                    <div className="input-box">
                      <Calendar size={16} className="input-icon" />
                      <input
                        id="returnDate"
                        name="returnDate"
                        type="date"
                        required
                        min={bookingForm.pickupDate}
                        value={bookingForm.returnDate}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <div className="form-field">
                    <label htmlFor="returnTime">Return Time</label>
                    <div className="input-box">
                      <Clock size={16} className="input-icon" />
                      <input
                        id="returnTime"
                        name="returnTime"
                        type="time"
                        required
                        value={bookingForm.returnTime}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                </div>

                {/* Availability Status Badge */}
                {vehicle && !vehicle.isCatalogOnly && (
                  <div className={`availability-banner ${checkingAvailability ? 'loading' : (!isStatusBlocked && availability.available) ? 'available' : 'unavailable'}`}>
                    <div className="avail-status-dot"></div>
                    <span className="avail-status-text">
                      {isStatusBlocked
                        ? statusBlockedReason
                        : checkingAvailability
                        ? 'Verifying fleet availability with database...'
                        : availability.available
                        ? `Available for requested dates (${vehicle.registration_number || 'Live Unit'})`
                        : availability.reason || 'Vehicle is not available for the selected dates.'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Customer Information Card */}
            <div className="booking-card">
              <div className="card-header">
                <User size={18} className="card-header-icon" />
                <h3 className="card-heading">Driver & Contact Information</h3>
              </div>

              <div className="card-body">
                <div className="form-group-grid">
                  <div className="form-field">
                    <label>Full Name</label>
                    <input
                      type="text"
                      disabled
                      value={`${user?.first_name || ''} ${user?.last_name || ''}`}
                      className="readonly-input"
                    />
                  </div>

                  <div className="form-field">
                    <label>Email Address</label>
                    <input
                      type="email"
                      disabled
                      value={user?.email || ''}
                      className="readonly-input"
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="phone">Phone Number (+91)</label>
                    <div className="input-box">
                      <Phone size={16} className="input-icon" />
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        required
                        placeholder="+919876543210"
                        value={effectivePhone}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <div className="form-field">
                    <label htmlFor="drivingLicenseNumber">Driving License Number</label>
                    <div className="input-box">
                      <ShieldCheck size={16} className="input-icon" />
                      <input
                        id="drivingLicenseNumber"
                        name="drivingLicenseNumber"
                        type="text"
                        required
                        placeholder="e.g. KA0120230012345"
                        value={effectiveLicense}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                </div>

                <p className="field-note">
                  * Physical original driving license and Aadhaar card must be presented during vehicle handover at the hub.
                </p>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Selected Vehicle & Pricing Summary */}
          <div className="booking-summary-column">
            <div className="summary-sticky-card">
              <h3 className="summary-heading">Booking Summary</h3>

              {/* Selected Vehicle Card */}
              {vehicle && (
                <div className="summary-vehicle-box">
                  <VehicleImage
                    vehicle={vehicle}
                    src={vehicle.image}
                    alt={`${vehicle.make || vehicle.brand} ${vehicle.model}`}
                    className="summary-vehicle-img"
                    loading="eager"
                  />
                  <div className="summary-vehicle-info">
                    <span className="summary-vehicle-category">
                      {vehicle.category_name || vehicle.categoryName || 'Vehicle'}
                    </span>
                    <h4 className="summary-vehicle-name">
                      {vehicle.make ? `${vehicle.make} ${vehicle.model}` : vehicle.name}
                    </h4>
                    {vehicle.registration_number && (
                      <span className="summary-reg-badge">
                        Reg: {vehicle.registration_number}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Price Calculation Breakdown */}
              <div className="pricing-breakdown-list">
                <div className="breakdown-row">
                  <span className="breakdown-label">Rental Duration</span>
                  <strong className="breakdown-val">
                    {rentalCalculation.days} {rentalCalculation.days === 1 ? 'Day' : 'Days'}
                  </strong>
                </div>

                <div className="breakdown-row">
                  <span className="breakdown-label">Daily Rental Rate</span>
                  <span className="breakdown-val">
                    ₹{rentalCalculation.dailyRate.toLocaleString('en-IN')} / day
                  </span>
                </div>

                <div className="breakdown-row">
                  <span className="breakdown-label">Base Rental Amount</span>
                  <span className="breakdown-val">
                    ₹{rentalCalculation.baseAmount.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="breakdown-row">
                  <span className="breakdown-label">Refundable Security Deposit</span>
                  <span className="breakdown-val">
                    ₹{rentalCalculation.deposit.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="breakdown-divider"></div>

                <div className="breakdown-total-row">
                  <span className="total-label">Total Amount Payable</span>
                  <strong className="total-value">
                    ₹{rentalCalculation.totalAmount.toLocaleString('en-IN')}
                  </strong>
                </div>
              </div>

              <div className="summary-fineprint">
                <Shield size={14} className="shield-icon" />
                <span>Zero hidden cancellation fee before scheduled pickup. Security deposit returned after inspection.</span>
              </div>

              {/* Submit / Proceed to Payment Button */}
              <button
                type="submit"
                disabled={isSubmitting || checkingAvailability || isStatusBlocked || (vehicle && vehicle.isCatalogOnly) || (!availability.available && availability.checked)}
                className="btn btn-primary btn-proceed-payment"
              >
                {isSubmitting ? (
                  <span>Reserving Vehicle...</span>
                ) : (
                  <>
                    <CreditCard size={18} />
                    <span>Proceed to Payment</span>
                  </>
                )}
              </button>

              <div className="summary-guarantee">
                <CheckCircle2 size={14} className="check-icon" />
                <span>Genuine database booking record with unique reference</span>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
