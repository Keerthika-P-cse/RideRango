import { memo } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Fuel, Gauge, Settings, Users } from 'lucide-react'
import VehicleImage from '../common/VehicleImage.jsx'
import {
  getAvailabilityClass,
  getAvailabilityLabel,
  isStatusBookingBlocked,
  normaliseAvailabilityStatus
} from '../../utils/vehicleStatusHelper.js'
import './VehicleCard.css'

function VehicleCard({ vehicle, searchContext = '' }) {
  if (!vehicle) return null

  // Ensure price is properly formatted
  const price = typeof vehicle.pricePerDay === 'number'
    ? vehicle.pricePerDay
    : parseFloat(vehicle.daily_rate || 0)

  const rawStatus = vehicle.availabilityStatus || vehicle.availability_status || 'available'
  const status = normaliseAvailabilityStatus(rawStatus)
  const isAvailable = status === 'available'
  const isDemo = status === 'demo'
  const bookingBlocked = isStatusBookingBlocked(status)
  const statusClass = getAvailabilityClass(status)
  const statusLabel = isAvailable && vehicle.unitsCount > 1
    ? `Available (${vehicle.unitsCount} vehicles)`
    : getAvailabilityLabel(status)

  const detailsUrl = `/vehicles/${vehicle.id}${searchContext ? `?${searchContext}` : ''}`
  const targetVehicleId = vehicle.primaryDbId || vehicle.id
  const bookNowUrl = `/booking?vehicleId=${targetVehicleId}${searchContext ? `&${searchContext}` : ''}`

  return (
    <div className={`vehicle-catalog-card ${!isAvailable ? 'card-unavailable' : ''}`}>
      {/* Photo Frame */}
      <div className="card-image-box">
        <VehicleImage
          vehicle={vehicle}
          src={vehicle.image}
          alt={`${vehicle.brand || vehicle.make} ${vehicle.model}`}
          loading="lazy"
          className="card-image"
        />

        <div className="card-badges-row">
          <span className="card-category-badge">
            {vehicle.categoryName || vehicle.category_name || 'Vehicle'}
          </span>

          <span className={`card-status-badge status-${statusClass}`}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Content Area */}
      <div className="card-body">
        <div className="card-title-group">
          <span className="card-brand">{vehicle.brand || vehicle.make}</span>
          <h3 className="card-model">{vehicle.name || `${vehicle.make} ${vehicle.model}`}</h3>
        </div>

        {/* Specs Grid */}
        <div className="card-specs-grid">
          <div className="spec-item" title="Fuel Type">
            <Fuel size={14} className="spec-icon" />
            <span>{vehicle.fuelType || vehicle.fuel_type}</span>
          </div>

          {vehicle.transmission && (
            <div className="spec-item" title="Transmission">
              <Settings size={14} className="spec-icon" />
              <span>{vehicle.transmission}</span>
            </div>
          )}

          {vehicle.seatingCapacity && (
            <div className="spec-item" title="Seating Capacity">
              <Users size={14} className="spec-icon" />
              <span>{vehicle.seatingCapacity || vehicle.seating_capacity} Seats</span>
            </div>
          )}

          {(vehicle.mileageOrRange || vehicle.features?.range_km) && (
            <div className="spec-item" title="Mileage / Range">
              <Gauge size={14} className="spec-icon" />
              <span>{vehicle.mileageOrRange || `${vehicle.features?.range_km} km range`}</span>
            </div>
          )}
        </div>

        {/* Footer Pricing & CTA */}
        <div className="card-footer">
          <div className="price-block">
            <span className="price-label">Price per Day</span>
            <div className="price-value-row">
              <strong className="price-amount">₹{price.toLocaleString('en-IN')}</strong>
              <span className="price-unit">/ day</span>
            </div>
          </div>

          <div className="card-actions-group">
            <Link to={detailsUrl} className="btn btn-secondary card-action-btn">
              <Eye size={16} />
              <span>View Details</span>
            </Link>

            {bookingBlocked ? (
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="btn card-action-btn card-book-disabled"
                title={isDemo ? 'Demo – Not Available for Booking' : statusLabel}
              >
                <span>{isDemo ? 'Demo Only' : 'Unavailable'}</span>
              </button>
            ) : (
              <Link to={bookNowUrl} className="btn btn-primary card-action-btn">
                <span>Book Now</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default memo(VehicleCard)
