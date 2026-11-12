import { useState, useEffect, useMemo } from 'react'
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Fuel,
  Gauge,
  Info,
  MapPin,
  Settings,
  Shield,
  Sparkles,
  Users
} from 'lucide-react'
import api from '../../services/api.js'
import { getVehicleById as getFallbackVehicle } from '../../data/vehiclesData.js'
import VehicleImage from '../../components/common/VehicleImage.jsx'
import {
  findMatchingDbUnit,
  getAvailabilityClass,
  getAvailabilityLabel,
  getBookingUnavailableReason,
  isStatusBookingBlocked,
  normaliseAvailabilityStatus
} from '../../utils/vehicleStatusHelper.js'
import './VehicleDetailPage.css'

// Helper to format ISO date to DD-MM-YYYY
const formatIndianDate = (isoStr) => {
  if (!isoStr) return ''
  const parts = isoStr.split('-')
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`
  }
  return isoStr
}

export default function VehicleDetailPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [vehicle, setVehicle] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activePhoto, setActivePhoto] = useState('')

  // Search parameters from trip
  const pickupDate = searchParams.get('pickupDate') || ''
  const pickupTime = searchParams.get('pickupTime') || '10:00'
  const returnDate = searchParams.get('returnDate') || ''
  const returnTime = searchParams.get('returnTime') || '10:00'
  const pickupHub = searchParams.get('location') || ''

  // Calculate rental duration in days
  const rentalDays = useMemo(() => {
    if (!pickupDate || !returnDate) return null
    const start = new Date(pickupDate)
    const end = new Date(returnDate)
    const diffTime = end.getTime() - start.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays > 0 ? diffDays : 1
  }, [pickupDate, returnDate])

  useEffect(() => {
    let isMounted = true

    async function loadVehicle() {
      // 1. Try to fetch from backend API if ID is numeric
      if (/^\d+$/.test(id)) {
        try {
          const res = await api.getVehicleById(id)
          if (isMounted && res && res.success && res.data) {
            setVehicle(res.data)
            setActivePhoto(res.data.image)
            setIsLoading(false)
            return
          }
        } catch (err) {
          console.warn('Backend fetch note for ID', id, err.message)
        }
      }

      // 2. Fetch catalog model & link live database unit
      const fallback = getFallbackVehicle(id)
      if (isMounted) {
        if (fallback) {
          const enriched = { ...fallback, isLiveFleet: false }
          try {
            const res = await api.getVehicles()
            if (isMounted && res && res.success && res.data && res.data.vehicles) {
              const matchedDb = findMatchingDbUnit(enriched, res.data.vehicles)
              if (matchedDb) {
                enriched.isLiveFleet = true
                enriched.primaryDbId = matchedDb.id
                enriched.registration_number = matchedDb.registration_number
                enriched.availability_status = matchedDb.availability_status
                enriched.location = matchedDb.location || enriched.location
                enriched.daily_rate = matchedDb.daily_rate
                enriched.security_deposit = matchedDb.security_deposit
                enriched.image = matchedDb.image || enriched.image
              }
            }
          } catch {
            // Keep catalog representation gracefully
          }

          setVehicle(enriched)
          setActivePhoto(enriched.image || '')
        } else {
          setVehicle(null)
        }
        setIsLoading(false)
      }
    }

    loadVehicle()

    return () => {
      isMounted = false
    }
  }, [id])

  if (isLoading) {
    return (
      <div className="detail-loading-wrapper">
        <div className="loading-spinner"></div>
        <p className="loading-text">Loading vehicle details...</p>
      </div>
    )
  }

  if (!vehicle) {
    return (
      <div className="vehicle-not-found-wrapper">
        <div className="not-found-card">
          <Info size={40} className="not-found-icon" />
          <h2 className="not-found-title">Vehicle Not Found</h2>
          <p className="not-found-desc">
            We could not find the vehicle you requested. It may have been relocated or updated.
          </p>
          <Link to="/vehicles" className="btn btn-primary">
            <ArrowLeft size={16} />
            <span>Back to Vehicles</span>
          </Link>
        </div>
      </div>
    )
  }

  const price = typeof vehicle.pricePerDay === 'number'
    ? vehicle.pricePerDay
    : parseFloat(vehicle.daily_rate || 0)

  const securityDeposit = typeof vehicle.securityDeposit === 'number'
    ? vehicle.securityDeposit
    : parseFloat(vehicle.security_deposit || 2000)

  const estimatedTotal = rentalDays ? rentalDays * price : null
  const rawStatus = vehicle.availability_status || vehicle.availabilityStatus || 'available'
  const status = normaliseAvailabilityStatus(rawStatus)
  const statusClass = getAvailabilityClass(status)
  const statusLabel = status === 'available' ? 'Available' : getAvailabilityLabel(status)
  const bookingBlocked = isStatusBookingBlocked(status)
  const unavailableReason = getBookingUnavailableReason(status)

  // Strictly show verified model photographs only (never mix unrelated category images)
  const photoGallery = [...new Set([vehicle.image])].filter(Boolean)

  // Preserve search parameters for back button and booking
  const searchContext = searchParams.toString()
  const backToVehiclesUrl = `/vehicles${searchContext ? `?${searchContext}` : ''}`
  const targetVehicleId = vehicle.primaryDbId || vehicle.id
  const bookNowUrl = `/booking?vehicleId=${targetVehicleId}${searchContext ? `&${searchContext}` : ''}`

  return (
    <div className="vehicle-detail-wrapper">
      <div className="detail-container">
        {/* Navigation Breadcrumb / Back Action */}
        <div className="detail-nav-bar">
          <Link to={backToVehiclesUrl} className="btn-back-link">
            <ArrowLeft size={16} />
            <span>Back to Vehicles</span>
          </Link>

          <div className="detail-badge-group">
            <span className="detail-category-badge">
              {vehicle.categoryName || vehicle.category_name || 'Vehicle'}
            </span>
            <span className={`detail-status-pill status-${statusClass}`}>
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Main Vehicle Showcase Layout */}
        <div className="detail-layout-grid">
          {/* Left Column: Visual Showcase & Specifications */}
          <div className="detail-visual-column">
            {/* Main Stage Image */}
            <div className="main-image-stage">
              <VehicleImage
                vehicle={vehicle}
                src={activePhoto || vehicle.image}
                alt={`${vehicle.brand || vehicle.make} ${vehicle.model}`}
                className="stage-image"
                loading="eager"
              />
            </div>

            {/* Thumbnail Gallery (only shown when multiple model-specific images exist) */}
            {photoGallery.length > 1 && (
              <div className="thumbnail-strip">
                {photoGallery.map((imgSrc, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`thumbnail-btn ${activePhoto === imgSrc ? 'selected' : ''}`}
                    onClick={() => setActivePhoto(imgSrc)}
                    aria-label={`View photograph ${idx + 1}`}
                  >
                    <img src={imgSrc} alt={`Thumbnail ${idx + 1}`} className="thumbnail-img" />
                  </button>
                ))}
              </div>
            )}

            {/* Description Card */}
            <div className="detail-section-card">
              <h3 className="section-card-title">About this Vehicle</h3>
              <p className="vehicle-long-desc">
                {vehicle.description ||
                  `The ${vehicle.brand || vehicle.make} ${vehicle.model} offers dependable performance, comfortable ergonomics, and practical luggage space for city drives and highway travel across Bengaluru.`}
              </p>
            </div>

            {/* Specifications Grid */}
            <div className="detail-section-card">
              <h3 className="section-card-title">Key Specifications</h3>
              <div className="specs-full-grid">
                <div className="spec-card-item">
                  <Fuel size={20} className="spec-item-icon" />
                  <div className="spec-card-meta">
                    <span className="spec-meta-label">Fuel Type</span>
                    <strong className="spec-meta-value">{vehicle.fuelType || vehicle.fuel_type}</strong>
                  </div>
                </div>

                <div className="spec-card-item">
                  <Settings size={20} className="spec-item-icon" />
                  <div className="spec-card-meta">
                    <span className="spec-meta-label">Transmission</span>
                    <strong className="spec-meta-value">{vehicle.transmission || 'Automatic'}</strong>
                  </div>
                </div>

                <div className="spec-card-item">
                  <Users size={20} className="spec-item-icon" />
                  <div className="spec-card-meta">
                    <span className="spec-meta-label">Seating Capacity</span>
                    <strong className="spec-meta-value">
                      {vehicle.seatingCapacity || vehicle.seating_capacity || 2} Passengers
                    </strong>
                  </div>
                </div>

                <div className="spec-card-item">
                  <Gauge size={20} className="spec-item-icon" />
                  <div className="spec-card-meta">
                    <span className="spec-meta-label">Mileage / Range</span>
                    <strong className="spec-meta-value">
                      {vehicle.mileageOrRange || (vehicle.features?.range_km ? `${vehicle.features.range_km} km range` : 'Standard Efficiency')}
                    </strong>
                  </div>
                </div>

                <div className="spec-card-item">
                  <MapPin size={20} className="spec-item-icon" />
                  <div className="spec-card-meta">
                    <span className="spec-meta-label">Pickup Hub</span>
                    <strong className="spec-meta-value">
                      {pickupHub || vehicle.location || 'Indiranagar Hub, Bengaluru'}
                    </strong>
                  </div>
                </div>

                <div className="spec-card-item">
                  <Sparkles size={20} className="spec-item-icon" />
                  <div className="spec-card-meta">
                    <span className="spec-meta-label">Price Category</span>
                    <strong className="spec-meta-value">
                      {vehicle.tier || vehicle.priceCategory || 'Medium-priced'}
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Pricing, Rental Calculator & Booking Action */}
          <aside className="detail-sidebar-column">
            <div className="booking-summary-card">
              <div className="summary-header">
                <span className="vehicle-brand-eyebrow">{vehicle.brand || vehicle.make}</span>
                <h1 className="vehicle-main-title">{vehicle.name || `${vehicle.make} ${vehicle.model}`}</h1>
                {vehicle.registration_number && (
                  <span className="registration-pill">Reg: {vehicle.registration_number}</span>
                )}
              </div>

              {/* Price Callout */}
              <div className="rate-callout-box">
                <div className="daily-rate-display">
                  <span className="rate-currency">₹</span>
                  <span className="rate-large">{price.toLocaleString('en-IN')}</span>
                  <span className="rate-period">/ day</span>
                </div>
                <span className="rate-note">Clear daily rate &bull; Zero hidden fees</span>
              </div>

              {/* Trip Selection Summary (if provided via Search) */}
              <div className="trip-dates-box">
                <h4 className="trip-dates-title">Rental Schedule</h4>

                {pickupDate && returnDate ? (
                  <div className="selected-schedule-list">
                    <div className="schedule-row">
                      <div className="schedule-col">
                        <span className="schedule-tag">Vehicle Pickup</span>
                        <div className="schedule-val-group">
                          <Calendar size={14} className="sched-icon" />
                          <strong>{formatIndianDate(pickupDate)}</strong>
                          <span className="sched-time">({pickupTime})</span>
                        </div>
                      </div>

                      <div className="schedule-col">
                        <span className="schedule-tag">Vehicle Return</span>
                        <div className="schedule-val-group">
                          <Calendar size={14} className="sched-icon" />
                          <strong>{formatIndianDate(returnDate)}</strong>
                          <span className="sched-time">({returnTime})</span>
                        </div>
                      </div>
                    </div>

                    <div className="duration-pill">
                      <Clock size={13} />
                      <span>Duration: <strong>{rentalDays} {rentalDays === 1 ? 'day' : 'days'}</strong></span>
                    </div>
                  </div>
                ) : (
                  <div className="no-dates-notice">
                    <p className="notice-text">
                      No travel dates selected yet. You can book directly or choose your dates on the Home Page.
                    </p>
                  </div>
                )}
              </div>

              {/* Estimated Price Breakdown */}
              <div className="pricing-breakdown-card">
                <h4 className="breakdown-title">Rental Price Details</h4>

                <div className="breakdown-line">
                  <span>Daily Rate</span>
                  <span>₹{price.toLocaleString('en-IN')}</span>
                </div>

                {rentalDays && (
                  <div className="breakdown-line">
                    <span>Duration ({rentalDays} {rentalDays === 1 ? 'day' : 'days'})</span>
                    <span>₹{(rentalDays * price).toLocaleString('en-IN')}</span>
                  </div>
                )}

                <div className="breakdown-line">
                  <span>Refundable Security Deposit</span>
                  <span>₹{securityDeposit.toLocaleString('en-IN')}</span>
                </div>

                <div className="breakdown-divider"></div>

                <div className="breakdown-total-line">
                  <span>Estimated Total</span>
                  <strong className="total-amount">
                    ₹{((estimatedTotal || price) + securityDeposit).toLocaleString('en-IN')}
                  </strong>
                </div>

                <p className="deposit-fineprint">
                  * Security deposit of ₹{securityDeposit.toLocaleString('en-IN')} is refunded upon safe return of the vehicle.
                </p>
              </div>

              {/* Booking Actions */}
              {bookingBlocked && (
                <div className="booking-unavailable-notice" role="status">
                  <AlertTriangle size={16} className="notice-icon" />
                  <span>{unavailableReason}</span>
                </div>
              )}

              <div className="booking-cta-group">
                {bookingBlocked ? (
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    className="btn btn-book-vehicle btn-book-disabled"
                  >
                    <span>{statusLabel} — Booking Unavailable</span>
                  </button>
                ) : (
                  <Link to={bookNowUrl} className="btn btn-primary btn-book-vehicle">
                    <span>Book Now</span>
                  </Link>
                )}

                <button
                  type="button"
                  onClick={() => navigate(backToVehiclesUrl)}
                  className="btn btn-secondary btn-return-catalog"
                >
                  <ArrowLeft size={16} />
                  <span>Back to Vehicles</span>
                </button>
              </div>

              {/* Guarantees List */}
              <div className="detail-guarantees">
                <div className="guarantee-item">
                  <CheckCircle2 size={16} className="guarantee-icon" />
                  <span>Instant confirmation online</span>
                </div>
                <div className="guarantee-item">
                  <Shield size={16} className="guarantee-icon" />
                  <span>100% transparent daily pricing</span>
                </div>
                <div className="guarantee-item">
                  <MapPin size={16} className="guarantee-icon" />
                  <span>Collect from designated Bengaluru hub</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
