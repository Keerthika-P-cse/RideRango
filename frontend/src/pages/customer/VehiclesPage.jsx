import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  Calendar,
  Clock,
  Filter,
  Layers,
  MapPin,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X
} from 'lucide-react'
import api from '../../services/api.js'
import {
  categoriesData,
  vehiclesData as fallbackCatalog,
  getDistinctBrands
} from '../../data/vehiclesData.js'
import VehicleCard from '../../components/customer/VehicleCard.jsx'
import FilterPanel from '../../components/customer/FilterPanel.jsx'
import { matchDbVehicleToCatalog } from '../../utils/vehicleStatusHelper.js'
import './VehiclesPage.css'

// Helper to format ISO date to DD-MM-YYYY
const formatIndianDate = (isoStr) => {
  if (!isoStr) return ''
  const parts = isoStr.split('-')
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`
  }
  return isoStr
}

export default function VehiclesPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  // 1. Home Page search context parameters
  const searchLocation = searchParams.get('location') || ''
  const searchPickupDate = searchParams.get('pickupDate') || ''
  const searchPickupTime = searchParams.get('pickupTime') || ''
  const searchReturnDate = searchParams.get('returnDate') || ''
  const searchReturnTime = searchParams.get('returnTime') || ''

  // Has active home search query
  const hasActiveSearch = Boolean(searchLocation || searchPickupDate || searchReturnDate)

  // 2. Filter states directly derived from searchParams as single source of truth
  const filters = useMemo(() => ({
    category: searchParams.get('category') || 'all',
    brand: searchParams.get('brand') || '',
    fuelType: searchParams.get('fuelType') || '',
    transmission: searchParams.get('transmission') || '',
    tier: searchParams.get('tier') || '',
    seatingCapacity: searchParams.get('seatingCapacity') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || ''
  }), [searchParams])

  // 3. Sorting
  const sortBy = searchParams.get('sort') || 'default'

  // 4. View Mode: "all" (Full Indian Vehicle Catalogue) vs "backend" (Live DB records)
  const [catalogScope, setCatalogScope] = useState('all')

  // 5. Backend fetch state
  const [backendVehicles, setBackendVehicles] = useState([])
  const [backendTotal, setBackendTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [apiError, setApiError] = useState(null)
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false)

  // Fetch from backend API
  const fetchBackendData = useCallback(async () => {
    setIsLoading(true)
    setApiError(null)
    try {
      const res = await api.getVehicles({
        category: filters.category !== 'all' ? filters.category : undefined,
        brand: filters.brand || undefined,
        fuelType: filters.fuelType || undefined,
        transmission: filters.transmission || undefined,
        seatingCapacity: filters.seatingCapacity || undefined,
        minPrice: filters.minPrice || undefined,
        maxPrice: filters.maxPrice || undefined,
        sort: sortBy !== 'default' ? sortBy : undefined
      })

      if (res && res.success && res.data) {
        setBackendVehicles(res.data.vehicles || [])
        setBackendTotal(res.data.total || 0)
      } else {
        setBackendVehicles([])
        setBackendTotal(0)
      }
    } catch (err) {
      console.warn('Backend API connection note:', err.message)
      setApiError(err.message || 'Unable to load vehicles. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [filters, sortBy])

  useEffect(() => {
    let isMounted = true

    api.getVehicles({
      category: filters.category !== 'all' ? filters.category : undefined,
      brand: filters.brand || undefined,
      fuelType: filters.fuelType || undefined,
      transmission: filters.transmission || undefined,
      seatingCapacity: filters.seatingCapacity || undefined,
      minPrice: filters.minPrice || undefined,
      maxPrice: filters.maxPrice || undefined,
      sort: sortBy !== 'default' ? sortBy : undefined
    }).then((res) => {
      if (!isMounted) return
      if (res && res.success && res.data) {
        setBackendVehicles(res.data.vehicles || [])
        setBackendTotal(res.data.total || 0)
        setApiError(null)
      } else {
        setBackendVehicles([])
        setBackendTotal(0)
        setApiError(res?.message || 'Unable to verify live fleet availability.')
      }
    }).catch((err) => {
      if (isMounted) {
        setApiError(err.message || 'Unable to load vehicles. Please try again.')
      }
    }).finally(() => {
      if (isMounted) {
        setIsLoading(false)
      }
    })

    return () => {
      isMounted = false
    }
  }, [filters, sortBy])

  // Update URL search parameters when filters change without losing search context
  const updateUrlParams = (newFilters, newSort = sortBy) => {
    const nextParams = new URLSearchParams()

    // Preserve home search context
    if (searchLocation) nextParams.set('location', searchLocation)
    if (searchPickupDate) nextParams.set('pickupDate', searchPickupDate)
    if (searchPickupTime) nextParams.set('pickupTime', searchPickupTime)
    if (searchReturnDate) nextParams.set('returnDate', searchReturnDate)
    if (searchReturnTime) nextParams.set('returnTime', searchReturnTime)

    // Set filter params
    if (newFilters.category && newFilters.category !== 'all') {
      nextParams.set('category', newFilters.category)
    }
    if (newFilters.brand) nextParams.set('brand', newFilters.brand)
    if (newFilters.fuelType) nextParams.set('fuelType', newFilters.fuelType)
    if (newFilters.transmission) nextParams.set('transmission', newFilters.transmission)
    if (newFilters.tier) nextParams.set('tier', newFilters.tier)
    if (newFilters.seatingCapacity) nextParams.set('seatingCapacity', newFilters.seatingCapacity)
    if (newFilters.minPrice) nextParams.set('minPrice', newFilters.minPrice)
    if (newFilters.maxPrice) nextParams.set('maxPrice', newFilters.maxPrice)
    if (newSort && newSort !== 'default') nextParams.set('sort', newSort)

    setSearchParams(nextParams)
  }

  const handleCategoryTab = (catSlug) => {
    const updated = { ...filters, category: catSlug, brand: '' }
    updateUrlParams(updated)
  }

  const handleFilterChange = (updatedFilters) => {
    updateUrlParams(updatedFilters)
  }

  const handleResetFilters = () => {
    const cleared = {
      category: 'all',
      brand: '',
      fuelType: '',
      transmission: '',
      tier: '',
      seatingCapacity: '',
      minPrice: '',
      maxPrice: ''
    }
    updateUrlParams(cleared, 'default')
  }

  const handleSortChange = (e) => {
    const newSort = e.target.value
    updateUrlParams(filters, newSort)
  }

  const clearHomeSearch = () => {
    const nextParams = new URLSearchParams()
    if (filters.category && filters.category !== 'all') {
      nextParams.set('category', filters.category)
    }
    setSearchParams(nextParams)
  }

  // 1. Group database vehicles by their matched catalogue model ID
  const dbUnitsByModel = useMemo(() => {
    const map = {}
    backendVehicles.forEach((v) => {
      const matched = matchDbVehicleToCatalog(v, fallbackCatalog)
      const key = matched ? matched.id : `db-${v.id}`
      if (!map[key]) {
        map[key] = []
      }
      map[key].push(v)
    })
    return map
  }, [backendVehicles])

  // 2. Build unified unique vehicle models with live fleet status attached
  const uniqueCatalogModels = useMemo(() => {
    const catalogIds = new Set(fallbackCatalog.map((m) => m.id))
    const mappedCatalog = fallbackCatalog.map((model) => {
      const liveUnits = dbUnitsByModel[model.id] || []
      const hasLiveUnits = liveUnits.length > 0
      const primaryUnit = hasLiveUnits ? liveUnits[0] : null
      const liveStatus = hasLiveUnits
        ? (liveUnits.some((u) => u.availability_status === 'available') ? 'available' : primaryUnit.availability_status)
        : (apiError ? 'status_unknown' : (isLoading ? 'loading' : 'demo'))

      return {
        ...model,
        hasLiveUnits,
        unitsCount: liveUnits.length,
        dbUnits: liveUnits,
        availabilityStatus: liveStatus,
        liveLocation: primaryUnit ? primaryUnit.location : null,
        liveDeposit: primaryUnit ? primaryUnit.security_deposit : model.securityDeposit,
        primaryDbId: primaryUnit ? primaryUnit.id : null,
        pricePerDay: primaryUnit ? primaryUnit.daily_rate : model.pricePerDay
      }
    })

    const extraDbModels = Object.entries(dbUnitsByModel)
      .filter(([key]) => !catalogIds.has(key))
      .map(([, units]) => {
        const primary = units[0]
        const slug = String(primary.category_slug || '').toLowerCase()
        const normCategory = slug === 'scooters' ? 'scooties' : (slug === 'commercial' ? 'utility' : slug || 'cars')
        return {
          id: String(primary.id),
          name: `${primary.make} ${primary.model}`,
          brand: primary.make,
          model: primary.model,
          category: normCategory,
          categoryName: primary.category_name || 'Vehicle',
          tier: primary.priceCategory || 'Medium-priced',
          pricePerDay: primary.daily_rate,
          securityDeposit: primary.security_deposit,
          fuelType: primary.fuel_type,
          transmission: primary.transmission,
          seatingCapacity: primary.seating_capacity,
          mileageOrRange: primary.features?.mileage_or_range || '',
          image: primary.image || '',
          location: primary.location,
          hasLiveUnits: true,
          unitsCount: units.length,
          dbUnits: units,
          availabilityStatus: primary.availability_status || 'available',
          liveLocation: primary.location,
          liveDeposit: primary.security_deposit,
          primaryDbId: primary.id
        }
      })

    return [...mappedCatalog, ...extraDbModels]
  }, [dbUnitsByModel, apiError, isLoading])

  // Count of unique models currently available in the database fleet
  const inFleetModelsCount = useMemo(() => {
    return uniqueCatalogModels.filter((m) => m.hasLiveUnits).length
  }, [uniqueCatalogModels])

  // 3. Filtered & sorted display list ensuring exactly ONE card per unique vehicle model
  const displayedVehicles = useMemo(() => {
    let list = [...uniqueCatalogModels]

    // Scope filter: In-fleet unique models only vs All catalogue models
    if (catalogScope === 'fleet' || catalogScope === 'backend') {
      list = list.filter((v) => v.hasLiveUnits)
    }

    // Category filter
    if (filters.category && filters.category !== 'all') {
      const cat = filters.category.toLowerCase()
      list = list.filter((v) => {
        if (cat === 'scooties' || cat === 'scooters') return v.category === 'scooties' || v.category === 'scooters'
        if (cat === 'utility' || cat === 'commercial') return v.category === 'utility' || v.category === 'commercial'
        return v.category === cat
      })
    }

    // Brand filter
    if (filters.brand) {
      list = list.filter((v) => v.brand.toLowerCase() === filters.brand.toLowerCase())
    }

    // Fuel Type filter
    if (filters.fuelType) {
      list = list.filter((v) => v.fuelType.toLowerCase() === filters.fuelType.toLowerCase())
    }

    // Transmission filter
    if (filters.transmission) {
      list = list.filter((v) => v.transmission.toLowerCase() === filters.transmission.toLowerCase())
    }

    // Tier / Price Category filter
    if (filters.tier) {
      list = list.filter((v) => v.tier === filters.tier)
    }

    // Seating Capacity
    if (filters.seatingCapacity) {
      list = list.filter((v) => v.seatingCapacity === parseInt(filters.seatingCapacity, 10))
    }

    // Price range
    if (filters.minPrice) {
      list = list.filter((v) => v.pricePerDay >= parseFloat(filters.minPrice))
    }
    if (filters.maxPrice) {
      list = list.filter((v) => v.pricePerDay <= parseFloat(filters.maxPrice))
    }

    // Sorting
    if (sortBy === 'price_asc') {
      list.sort((a, b) => a.pricePerDay - b.pricePerDay)
    } else if (sortBy === 'price_desc') {
      list.sort((a, b) => b.pricePerDay - a.pricePerDay)
    } else if (sortBy === 'name_asc') {
      list.sort((a, b) => a.name.localeCompare(b.name))
    }

    return list
  }, [uniqueCatalogModels, catalogScope, filters, sortBy])

  // Distinct options based on current category
  const availableBrands = useMemo(() => {
    return getDistinctBrands(filters.category !== 'all' ? filters.category : null)
  }, [filters.category])

  const availableFuelTypes = useMemo(() => {
    if (filters.category === 'scooties') return ['petrol', 'electric']
    if (filters.category === 'bikes') return ['petrol']
    if (filters.category === 'utility') return ['diesel', 'electric']
    return ['petrol', 'diesel', 'cng', 'hybrid', 'electric']
  }, [filters.category])

  const availableTransmissions = useMemo(() => {
    if (filters.category === 'scooties') return ['automatic']
    return ['manual', 'automatic']
  }, [filters.category])

  const availableSeating = useMemo(() => {
    if (filters.category === 'bikes' || filters.category === 'scooties') return [2]
    if (filters.category === 'cars') return [4, 5, 7]
    if (filters.category === 'utility') return [1, 2, 3, 5, 10, 12]
    return [2, 4, 5, 7, 10, 12]
  }, [filters.category])

  // Query string to pass to vehicle details so search context is preserved
  const searchContextString = searchParams.toString()

  return (
    <div className="vehicles-page-wrapper">
      {/* Top Banner & Header */}
      <section className="vehicles-header-section">
        <div className="vehicles-container">
          <div className="vehicles-header-content">
            <span className="section-eyebrow">Vehicle Collection</span>
            <h1 className="vehicles-page-title">Explore Vehicles</h1>
            <p className="vehicles-page-subtitle">
              Find the right car, bike, scooty or utility vehicle for your next trip.
            </p>
          </div>

          {/* Home Search Context Summary Banner (if routed from Home search) */}
          {hasActiveSearch && (
            <div className="search-context-card">
              <div className="search-context-header">
                <div className="context-title-group">
                  <Search size={16} className="context-icon" />
                  <span className="context-title">Your Selected Trip Details:</span>
                </div>
                <button
                  type="button"
                  onClick={clearHomeSearch}
                  className="btn-clear-search-context"
                  title="Clear trip parameters"
                >
                  <X size={14} />
                  <span>Clear Trip</span>
                </button>
              </div>

              <div className="search-context-chips">
                {searchLocation && (
                  <div className="context-chip">
                    <MapPin size={13} className="chip-icon" />
                    <span><strong>Pickup:</strong> {searchLocation}</span>
                  </div>
                )}
                {searchPickupDate && (
                  <div className="context-chip">
                    <Calendar size={13} className="chip-icon" />
                    <span><strong>Pickup Date:</strong> {formatIndianDate(searchPickupDate)}</span>
                  </div>
                )}
                {searchPickupTime && (
                  <div className="context-chip">
                    <Clock size={13} className="chip-icon" />
                    <span><strong>Time:</strong> {searchPickupTime}</span>
                  </div>
                )}
                {searchReturnDate && (
                  <div className="context-chip">
                    <Calendar size={13} className="chip-icon" />
                    <span><strong>Return Date:</strong> {formatIndianDate(searchReturnDate)}</span>
                  </div>
                )}
                {searchReturnTime && (
                  <div className="context-chip">
                    <Clock size={13} className="chip-icon" />
                    <span><strong>Time:</strong> {searchReturnTime}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Main Body: Tabs, Filters & Vehicle Grid */}
      <main className="vehicles-main-section">
        <div className="vehicles-container">
          {/* Category Tabs Bar */}
          <div className="category-tabs-bar">
            <div className="category-tabs-list" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={filters.category === 'all'}
                className={`category-tab-btn ${filters.category === 'all' ? 'active' : ''}`}
                onClick={() => handleCategoryTab('all')}
              >
                All Vehicles
              </button>
              {categoriesData.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={filters.category === cat.slug}
                  className={`category-tab-btn ${filters.category === cat.slug ? 'active' : ''}`}
                  onClick={() => handleCategoryTab(cat.slug)}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Scope Toggle: Available Vehicles vs All Catalogue Models */}
            <div className="scope-toggle-group">
              <button
                type="button"
                className={`scope-toggle-btn ${catalogScope === 'all' ? 'active' : ''}`}
                onClick={() => setCatalogScope('all')}
                title="View all vehicle models"
              >
                <Layers size={14} />
                <span>All Models ({fallbackCatalog.length})</span>
              </button>
              <button
                type="button"
                className={`scope-toggle-btn ${catalogScope === 'fleet' || catalogScope === 'backend' ? 'active' : ''}`}
                onClick={() => setCatalogScope('fleet')}
                title="View vehicles currently available for booking"
              >
                <span className="live-dot"></span>
                <span>Available Vehicles ({inFleetModelsCount})</span>
              </button>
            </div>
          </div>

          {/* Controls Bar: Count, Mobile Filter Trigger, and Sorting */}
          <div className="results-controls-bar">
            <div className="results-count-group">
              <span className="results-count-text">
                Showing <strong className="count-number">{displayedVehicles.length}</strong>{' '}
                unique {displayedVehicles.length === 1 ? 'vehicle model' : 'vehicle models'}
              </span>

              {(catalogScope === 'fleet' || catalogScope === 'backend') && (
                <span className="backend-live-indicator" title="Available vehicles">
                  <span className="indicator-dot"></span>
                  <span>All Vehicle Models ({inFleetModelsCount} models available &bull; {backendTotal} total units)</span>
                </span>
              )}
            </div>

            <div className="controls-right-group">
              {/* Mobile Filter Button */}
              <button
                type="button"
                onClick={() => setIsMobileFiltersOpen(true)}
                className="btn btn-secondary mobile-filter-trigger"
              >
                <SlidersHorizontal size={16} />
                <span>Filters</span>
              </button>

              {/* Sorting Select */}
              <div className="sort-select-box">
                <label htmlFor="sort-select" className="sort-label">
                  Sort By:
                </label>
                <select
                  id="sort-select"
                  value={sortBy}
                  onChange={handleSortChange}
                  className="sort-dropdown"
                >
                  <option value="default">Default Order</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="name_asc">Name: A to Z</option>
                </select>
              </div>
            </div>
          </div>

          {/* Layout: Sidebar Filter + Results Grid */}
          <div className="catalog-content-layout">
            {/* Filter Sidebar */}
            <FilterPanel
              filters={filters}
              onFilterChange={handleFilterChange}
              onResetFilters={handleResetFilters}
              availableBrands={availableBrands}
              availableFuelTypes={availableFuelTypes}
              availableTransmissions={availableTransmissions}
              availableSeating={availableSeating}
              isMobileOpen={isMobileFiltersOpen}
              onCloseMobile={() => setIsMobileFiltersOpen(false)}
            />

            {/* Results Grid / States */}
            <div className="catalog-results-area">
              {/* Backend API Error Banner (if connection failed) */}
              {apiError && (
                <div className="api-error-card" role="alert">
                  <AlertCircle size={20} className="error-icon" />
                  <div className="error-body">
                    <h4 className="error-title">Live Fleet Availability Unavailable</h4>
                    <p className="error-desc">
                      {apiError} Catalogue models are still shown below, but live booking availability could not be verified.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={fetchBackendData}
                    className="btn btn-secondary error-retry-btn"
                  >
                    <RefreshCw size={14} />
                    <span>Retry</span>
                  </button>
                </div>
              )}

              {/* Loading State */}
              {isLoading && catalogScope === 'backend' ? (
                <div className="loading-state-box">
                  <div className="loading-spinner"></div>
                  <p className="loading-text">Loading available vehicles...</p>
                </div>
              ) : displayedVehicles.length === 0 ? (
                /* Empty Results State */
                <div className="empty-results-box">
                  <div className="empty-icon-box">
                    <Filter size={32} />
                  </div>
                  <h3 className="empty-title">No vehicles match your selected filters</h3>
                  <p className="empty-desc">
                    Try clearing some filters or switching to another category to view available vehicles.
                  </p>
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="btn btn-primary empty-reset-btn"
                  >
                    Clear All Filters
                  </button>
                </div>
              ) : (
                /* Vehicles Card Grid */
                <div className="vehicles-cards-grid">
                  {displayedVehicles.map((vehicle) => (
                    <VehicleCard
                      key={vehicle.id}
                      vehicle={vehicle}
                      searchContext={searchContextString}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
