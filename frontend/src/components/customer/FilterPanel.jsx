import { Filter, RotateCcw, X } from 'lucide-react'
import './FilterPanel.css'

export default function FilterPanel({
  filters,
  onFilterChange,
  onResetFilters,
  availableBrands = [],
  availableFuelTypes = [],
  availableTransmissions = [],
  availableSeating = [],
  isMobileOpen,
  onCloseMobile
}) {
  const handleFieldChange = (key, value) => {
    const updated = {
      ...filters,
      [key]: value
    }
    if (key === 'category') {
      updated.brand = ''
    }
    onFilterChange(updated)
  }

  const handleApply = (e) => {
    e.preventDefault()
    onFilterChange(filters)
    if (onCloseMobile) {
      onCloseMobile()
    }
  }

  const handleReset = () => {
    onResetFilters()
    if (onCloseMobile) {
      onCloseMobile()
    }
  }

  const showTransmission = filters.category !== 'scooties'

  return (
    <aside className={`filter-sidebar ${isMobileOpen ? 'mobile-open' : ''}`}>
      <div className="filter-panel-card">
        {/* Panel Header */}
        <div className="filter-header">
          <div className="filter-header-title">
            <Filter size={18} className="filter-icon" />
            <h3 className="filter-title">Filters</h3>
          </div>

          <div className="filter-header-actions">
            <button
              type="button"
              onClick={handleReset}
              className="btn-reset-filters"
              title="Reset all filters"
            >
              <RotateCcw size={14} />
              <span>Clear</span>
            </button>

            {onCloseMobile && (
              <button
                type="button"
                onClick={onCloseMobile}
                className="btn-close-mobile"
                aria-label="Close filters"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleApply} className="filter-form">
          {/* 1. Vehicle Category */}
          <div className="filter-group">
            <label className="filter-label" htmlFor="filter-category">
              Vehicle Type
            </label>
            <select
              id="filter-category"
              className="filter-select"
              value={filters.category || 'all'}
              onChange={(e) => handleFieldChange('category', e.target.value)}
            >
              <option value="all">All Vehicles</option>
              <option value="cars">Cars</option>
              <option value="bikes">Bikes</option>
              <option value="scooties">Scooties</option>
              <option value="utility">Utility Vehicles</option>
            </select>
          </div>

          {/* 2. Brand */}
          <div className="filter-group">
            <label className="filter-label" htmlFor="filter-brand">
              Brand
            </label>
            <select
              id="filter-brand"
              className="filter-select"
              value={filters.brand || ''}
              onChange={(e) => handleFieldChange('brand', e.target.value)}
            >
              <option value="">All Brands</option>
              {availableBrands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Price Category / Tier */}
          <div className="filter-group">
            <label className="filter-label" htmlFor="filter-tier">
              Price Category
            </label>
            <select
              id="filter-tier"
              className="filter-select"
              value={filters.tier || ''}
              onChange={(e) => handleFieldChange('tier', e.target.value)}
            >
              <option value="">All Categories</option>
              <option value="Affordable">Affordable (&lt; ₹1,500 / day)</option>
              <option value="Medium-priced">Medium-priced (₹1,500 - ₹3,000)</option>
              <option value="Premium">Premium (&gt; ₹3,000 / day)</option>
            </select>
          </div>

          {/* 4. Fuel Type */}
          <div className="filter-group">
            <label className="filter-label" htmlFor="filter-fuel">
              Fuel Type
            </label>
            <select
              id="filter-fuel"
              className="filter-select"
              value={filters.fuelType || ''}
              onChange={(e) => handleFieldChange('fuelType', e.target.value)}
            >
              <option value="">All Fuel Types</option>
              {availableFuelTypes.map((fuel) => (
                <option key={fuel} value={fuel}>
                  {fuel.charAt(0).toUpperCase() + fuel.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Transmission (where applicable) */}
          {showTransmission && (
            <div className="filter-group">
              <label className="filter-label" htmlFor="filter-transmission">
                Transmission
              </label>
              <select
                id="filter-transmission"
                className="filter-select"
                value={filters.transmission || ''}
                onChange={(e) => handleFieldChange('transmission', e.target.value)}
              >
                <option value="">All Transmissions</option>
                {availableTransmissions.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 6. Seating Capacity (where applicable) */}
          {availableSeating.length > 0 && (
            <div className="filter-group">
              <label className="filter-label" htmlFor="filter-seating">
                Seating Capacity
              </label>
              <select
                id="filter-seating"
                className="filter-select"
                value={filters.seatingCapacity || ''}
                onChange={(e) => handleFieldChange('seatingCapacity', e.target.value)}
              >
                <option value="">Any Seating</option>
                {availableSeating.map((seats) => (
                  <option key={seats} value={seats}>
                    {seats} {seats === 1 ? 'Seat' : 'Seats'}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 7. Price Range per Day (₹) */}
          <div className="filter-group">
            <label className="filter-label">
              Price per Day (₹)
            </label>
            <div className="price-inputs-row">
              <div className="price-input-box">
                <span className="price-currency-tag">₹</span>
                <input
                  type="number"
                  placeholder="Min"
                  min="0"
                  max="10000"
                  step="100"
                  value={filters.minPrice || ''}
                  onChange={(e) => handleFieldChange('minPrice', e.target.value)}
                  className="filter-price-input"
                  aria-label="Minimum price per day"
                />
              </div>

              <span className="price-separator">&ndash;</span>

              <div className="price-input-box">
                <span className="price-currency-tag">₹</span>
                <input
                  type="number"
                  placeholder="Max"
                  min="0"
                  max="10000"
                  step="100"
                  value={filters.maxPrice || ''}
                  onChange={(e) => handleFieldChange('maxPrice', e.target.value)}
                  className="filter-price-input"
                  aria-label="Maximum price per day"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="filter-actions">
            <button type="submit" className="btn btn-primary filter-apply-btn">
              Apply Filters
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="btn btn-secondary filter-clear-btn"
            >
              Clear All Filters
            </button>
          </div>
        </form>
      </div>
    </aside>
  )
}
