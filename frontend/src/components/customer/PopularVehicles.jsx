import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowRight, Eye, Fuel, Gauge, Settings, Users } from 'lucide-react'
import api from '../../services/api.js'
import { getPopularVehicles } from '../../data/vehiclesData.js'
import {
  findMatchingDbUnit,
  getAvailabilityClass,
  getAvailabilityLabel,
  isStatusBookingBlocked,
  normaliseAvailabilityStatus
} from '../../utils/vehicleStatusHelper.js'
import VehicleImage from '../common/VehicleImage.jsx'
import './PopularVehicles.css'

export default function PopularVehicles() {
  const basePopularVehicles = useMemo(() => getPopularVehicles(), [])
  const [backendVehicles, setBackendVehicles] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [apiError, setApiError] = useState(null)

  useEffect(() => {
    let isMounted = true

    api.getVehicles()
      .then((res) => {
        if (!isMounted) return
        if (res && res.success && res.data) {
          setBackendVehicles(res.data.vehicles || [])
          setApiError(null)
        } else {
          setBackendVehicles([])
          setApiError(res?.message || 'Unable to verify live fleet availability.')
        }
      })
      .catch((err) => {
        if (isMounted) {
          setApiError(err.message || 'Unable to verify live fleet availability.')
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const popularVehicles = useMemo(() => {
    return basePopularVehicles.map((model) => {
      const matchedDb = findMatchingDbUnit(model, backendVehicles)
      const status = matchedDb
        ? matchedDb.availability_status
        : (apiError ? 'status_unknown' : (isLoading ? 'loading' : 'demo'))

      return {
        ...model,
        primaryDbId: matchedDb ? matchedDb.id : null,
        pricePerDay: matchedDb ? matchedDb.daily_rate : model.pricePerDay,
        availabilityStatus: status
      }
    })
  }, [basePopularVehicles, backendVehicles, apiError, isLoading])

  return (
    <section className="popular-section-wrapper">
      <div className="popular-container">
        {/* Section Header */}
        <div className="section-header">
          <div className="section-title-group">
            <span className="section-eyebrow">Customer Favorites</span>
            <h2 className="section-heading">Popular Vehicles</h2>
          </div>
          <div className="header-action-group">
            <p className="section-subtext">
              Popular Indian vehicles available for rental across our Bengaluru hubs.
            </p>
            <Link to="/vehicles" className="btn btn-secondary view-all-btn">
              <span>View All Vehicles</span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {apiError && (
          <div className="popular-api-error" role="alert">
            <AlertCircle size={16} />
            <span>Live fleet availability could not be verified ({apiError}).</span>
          </div>
        )}

        {/* Vehicles Grid */}
        <div className="vehicles-grid">
          {popularVehicles.map((vehicle) => {
            const status = normaliseAvailabilityStatus(vehicle.availabilityStatus)
            const statusClass = getAvailabilityClass(status)
            const statusLabel = getAvailabilityLabel(status)
            const isDemo = status === 'demo'
            const bookingBlocked = isStatusBookingBlocked(status)
            const targetVehicleId = vehicle.primaryDbId || vehicle.id

            return (
              <div key={vehicle.id} className="vehicle-card">
                {/* Photo Area */}
                <div className="vehicle-image-wrapper">
                  <VehicleImage
                    vehicle={vehicle}
                    src={vehicle.image}
                    alt={`${vehicle.brand} ${vehicle.model}`}
                    className="vehicle-photo"
                    loading="lazy"
                  />
                  <div className="vehicle-category-badge">
                    {vehicle.categoryName}
                  </div>
                  <div className={`vehicle-availability-tag status-${statusClass}`}>
                    {statusLabel}
                  </div>
                </div>

              {/* Vehicle Content */}
              <div className="vehicle-details">
                <div className="vehicle-header">
                  <span className="vehicle-brand">{vehicle.brand}</span>
                  <h3 className="vehicle-name">{vehicle.name}</h3>
                </div>

                {/* Key Specs Pills */}
                <div className="vehicle-specs-grid">
                  <div className="spec-item" title="Fuel Type">
                    <Fuel size={14} className="spec-icon" />
                    <span>{vehicle.fuelType}</span>
                  </div>

                  <div className="spec-item" title="Transmission">
                    <Settings size={14} className="spec-icon" />
                    <span>{vehicle.transmission}</span>
                  </div>

                  <div className="spec-item" title="Seating Capacity">
                    <Users size={14} className="spec-icon" />
                    <span>{vehicle.seatingCapacity} Seats</span>
                  </div>

                  <div className="spec-item" title="Mileage or Range">
                    <Gauge size={14} className="spec-icon" />
                    <span>{vehicle.mileageOrRange}</span>
                  </div>
                </div>

                {/* Pricing & View Details Action */}
                <div className="vehicle-footer-row">
                  <div className="price-box">
                    <span className="price-label">Daily Rental</span>
                    <div className="price-amount">
                      ₹{vehicle.pricePerDay.toLocaleString('en-IN')}
                      <span className="price-unit"> / day</span>
                    </div>
                  </div>

                  <div className="popular-card-actions">
                    <Link
                      to={`/vehicles/${vehicle.id}`}
                      className="btn btn-secondary vehicle-details-btn"
                    >
                      <Eye size={15} />
                      <span>View Details</span>
                    </Link>

                    {bookingBlocked ? (
                      <button
                        type="button"
                        disabled
                        aria-disabled="true"
                        className="btn vehicle-details-btn popular-book-disabled"
                        title={isDemo ? 'Demo – Not Available for Booking' : statusLabel}
                      >
                        <span>{isDemo ? 'Demo Only' : 'Unavailable'}</span>
                      </button>
                    ) : (
                      <Link
                        to={`/booking?vehicleId=${targetVehicleId}`}
                        className="btn btn-primary vehicle-details-btn"
                      >
                        <span>Book Now</span>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
