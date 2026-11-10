import { Link } from 'react-router-dom'
import { ArrowRight, Eye, Fuel, Gauge, Settings, Users } from 'lucide-react'
import { getPopularVehicles } from '../../data/vehiclesData.js'
import './PopularVehicles.css'

export default function PopularVehicles() {
  const popularVehicles = getPopularVehicles()

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

        {/* Vehicles Grid */}
        <div className="vehicles-grid">
          {popularVehicles.map((vehicle) => (
            <div key={vehicle.id} className="vehicle-card">
              {/* Photo Area */}
              <div className="vehicle-image-wrapper">
                <img
                  src={vehicle.image}
                  alt={`${vehicle.brand} ${vehicle.model}`}
                  className="vehicle-photo"
                  loading="lazy"
                />
                <div className="vehicle-category-badge">
                  {vehicle.categoryName}
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

                  <Link
                    to={`/vehicles/${vehicle.id}`}
                    className="btn btn-primary vehicle-details-btn"
                  >
                    <Eye size={15} />
                    <span>View Details</span>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
