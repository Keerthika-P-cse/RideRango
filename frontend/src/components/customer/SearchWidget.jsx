import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, Calendar, Clock, MapPin, Search } from 'lucide-react'
import { pickupLocations } from '../../data/vehiclesData.js'
import './SearchWidget.css'

const getInitialDates = () => {
  const today = new Date().toISOString().split('T')[0]
  const tomorrowDate = new Date()
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const tomorrow = tomorrowDate.toISOString().split('T')[0]
  return { today, tomorrow }
}

const { today: DEFAULT_TODAY, tomorrow: DEFAULT_TOMORROW } = getInitialDates()

/**
 * Format ISO date string (YYYY-MM-DD) into Indian standard DD-MM-YYYY
 */
const toIndianDateFormat = (isoDateStr) => {
  if (!isoDateStr) return ''
  const parts = isoDateStr.split('-')
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`
  }
  return isoDateStr
}

/**
 * Parse Indian standard DD-MM-YYYY string into ISO YYYY-MM-DD
 */
const parseIndianDateToIso = (indianDateStr) => {
  if (!indianDateStr) return ''
  const parts = indianDateStr.trim().split('-')
  if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
    const day = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10)
    const year = parseInt(parts[2], 10)
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2000) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`
    }
  }
  return ''
}

export default function SearchWidget() {
  const navigate = useNavigate()
  const pickupInputRef = useRef(null)
  const returnInputRef = useRef(null)

  const [searchParams, setSearchParams] = useState({
    vehicleType: 'all',
    pickupLocation: '', // Clear placeholder default
    pickupDate: DEFAULT_TODAY,
    pickupTime: '10:00',
    returnDate: DEFAULT_TOMORROW,
    returnTime: '10:00'
  })

  // Controlled visible display values formatted in DD-MM-YYYY
  const [pickupDisplay, setPickupDisplay] = useState(toIndianDateFormat(DEFAULT_TODAY))
  const [returnDisplay, setReturnDisplay] = useState(toIndianDateFormat(DEFAULT_TOMORROW))

  const [validationError, setValidationError] = useState('')

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setSearchParams((prev) => ({
      ...prev,
      [name]: value
    }))
    if (validationError) {
      setValidationError('')
    }
  }

  // Handle calendar picker selections (receives YYYY-MM-DD from native date picker)
  const handlePickupPickerChange = (e) => {
    const isoVal = e.target.value
    if (!isoVal) return
    setSearchParams((prev) => ({
      ...prev,
      pickupDate: isoVal
    }))
    setPickupDisplay(toIndianDateFormat(isoVal))
    if (validationError) {
      setValidationError('')
    }
  }

  const handleReturnPickerChange = (e) => {
    const isoVal = e.target.value
    if (!isoVal) return
    setSearchParams((prev) => ({
      ...prev,
      returnDate: isoVal
    }))
    setReturnDisplay(toIndianDateFormat(isoVal))
    if (validationError) {
      setValidationError('')
    }
  }

  // Handle manual typing in DD-MM-YYYY format
  const handlePickupTextChange = (e) => {
    const val = e.target.value
    setPickupDisplay(val)
    const iso = parseIndianDateToIso(val)
    if (iso) {
      setSearchParams((prev) => ({ ...prev, pickupDate: iso }))
    }
    if (validationError) {
      setValidationError('')
    }
  }

  const handlePickupTextBlur = () => {
    const iso = parseIndianDateToIso(pickupDisplay)
    if (iso) {
      setSearchParams((prev) => ({ ...prev, pickupDate: iso }))
      setPickupDisplay(toIndianDateFormat(iso))
    } else {
      setPickupDisplay(toIndianDateFormat(searchParams.pickupDate))
    }
  }

  const handleReturnTextChange = (e) => {
    const val = e.target.value
    setReturnDisplay(val)
    const iso = parseIndianDateToIso(val)
    if (iso) {
      setSearchParams((prev) => ({ ...prev, returnDate: iso }))
    }
    if (validationError) {
      setValidationError('')
    }
  }

  const handleReturnTextBlur = () => {
    const iso = parseIndianDateToIso(returnDisplay)
    if (iso) {
      setSearchParams((prev) => ({ ...prev, returnDate: iso }))
      setReturnDisplay(toIndianDateFormat(iso))
    } else {
      setReturnDisplay(toIndianDateFormat(searchParams.returnDate))
    }
  }

  const openPickupPicker = () => {
    if (pickupInputRef.current) {
      if (typeof pickupInputRef.current.showPicker === 'function') {
        try {
          pickupInputRef.current.showPicker()
          return
        } catch {
          // Fallback to focusing native input
        }
      }
      pickupInputRef.current.focus()
    }
  }

  const openReturnPicker = () => {
    if (returnInputRef.current) {
      if (typeof returnInputRef.current.showPicker === 'function') {
        try {
          returnInputRef.current.showPicker()
          return
        } catch {
          // Fallback to focusing native input
        }
      }
      returnInputRef.current.focus()
    }
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()

    // Validate unselected pickup location
    if (!searchParams.pickupLocation || searchParams.pickupLocation.trim() === '') {
      setValidationError('Please select a pickup location from the list.')
      return
    }

    if (!searchParams.pickupDate) {
      setValidationError('Please select a pickup date.')
      return
    }

    if (!searchParams.returnDate) {
      setValidationError('Please select a return date.')
      return
    }

    // Validate that return date and time is later than pickup date and time
    const pickupDateTime = new Date(`${searchParams.pickupDate}T${searchParams.pickupTime || '00:00'}`)
    const returnDateTime = new Date(`${searchParams.returnDate}T${searchParams.returnTime || '00:00'}`)

    if (returnDateTime <= pickupDateTime) {
      setValidationError('Return date and time must be later than pickup date and time.')
      return
    }

    // Preserve exact URL parameters in ISO format (YYYY-MM-DD)
    const query = new URLSearchParams({
      category: searchParams.vehicleType,
      location: searchParams.pickupLocation,
      pickupDate: searchParams.pickupDate,
      pickupTime: searchParams.pickupTime,
      returnDate: searchParams.returnDate,
      returnTime: searchParams.returnTime
    }).toString()

    navigate(`/vehicles?${query}`)
  }

  return (
    <section id="search-vehicles-section" className="search-widget-wrapper">
      <div className="search-widget-container">
        <div className="search-widget-card">
          <div className="search-header">
            <h2 className="search-title">Search Available Vehicles</h2>
            <p className="search-subtitle">
              Choose your vehicle type, pickup location and travel dates to find available rides.
            </p>
          </div>

          {validationError && (
            <div className="search-error-banner" role="alert">
              <AlertCircle size={18} />
              <span>{validationError}</span>
            </div>
          )}

          <form onSubmit={handleSearchSubmit} className="search-form">
            <div className="search-grid">
              {/* 1. Vehicle Type */}
              <div className="form-group">
                <label htmlFor="vehicleType">Vehicle Type</label>
                <div className="input-with-icon">
                  <select
                    id="vehicleType"
                    name="vehicleType"
                    value={searchParams.vehicleType}
                    onChange={handleInputChange}
                    className="search-select"
                  >
                    <option value="all">All Vehicles</option>
                    <option value="cars">Cars</option>
                    <option value="bikes">Bikes</option>
                    <option value="scooties">Scooties</option>
                    <option value="utility">Utility Vehicles (Trucks & Vans)</option>
                  </select>
                </div>
              </div>

              {/* 2. Pickup Location */}
              <div className="form-group">
                <label htmlFor="pickupLocation">Pickup Location</label>
                <div className="input-with-icon">
                  <MapPin size={16} className="field-icon" />
                  <select
                    id="pickupLocation"
                    name="pickupLocation"
                    value={searchParams.pickupLocation}
                    onChange={handleInputChange}
                    className="search-select with-icon"
                    required
                  >
                    <option value="" disabled>
                      Select Pickup Location
                    </option>
                    {pickupLocations.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3. Pickup Date (DD-MM-YYYY) */}
              <div className="form-group">
                <label htmlFor="pickupDate">Pickup Date</label>
                <div className="input-with-icon date-picker-container">
                  <Calendar size={16} className="field-icon" />
                  <input
                    type="text"
                    id="pickupDate"
                    name="pickupDateDisplay"
                    value={pickupDisplay}
                    onChange={handlePickupTextChange}
                    onBlur={handlePickupTextBlur}
                    onClick={openPickupPicker}
                    placeholder="DD-MM-YYYY"
                    className="search-input with-icon with-picker-btn"
                    pattern="[0-9]{2}-[0-9]{2}-[0-9]{4}"
                    autoComplete="off"
                    required
                  />
                  <div className="calendar-picker-trigger">
                    <button
                      type="button"
                      className="calendar-icon-btn"
                      onClick={openPickupPicker}
                      title="Select pickup date"
                      aria-label="Select pickup date"
                    >
                      <Calendar size={16} />
                    </button>
                    <input
                      ref={pickupInputRef}
                      type="date"
                      min={DEFAULT_TODAY}
                      value={searchParams.pickupDate}
                      onChange={handlePickupPickerChange}
                      className="native-date-hidden-overlay"
                      tabIndex={-1}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Pickup Time */}
              <div className="form-group">
                <label htmlFor="pickupTime">Pickup Time</label>
                <div className="input-with-icon">
                  <Clock size={16} className="field-icon" />
                  <input
                    type="time"
                    id="pickupTime"
                    name="pickupTime"
                    value={searchParams.pickupTime}
                    onChange={handleInputChange}
                    className="search-input with-icon"
                    required
                  />
                </div>
              </div>

              {/* 5. Return Date (DD-MM-YYYY) */}
              <div className="form-group">
                <label htmlFor="returnDate">Return Date</label>
                <div className="input-with-icon date-picker-container">
                  <Calendar size={16} className="field-icon" />
                  <input
                    type="text"
                    id="returnDate"
                    name="returnDateDisplay"
                    value={returnDisplay}
                    onChange={handleReturnTextChange}
                    onBlur={handleReturnTextBlur}
                    onClick={openReturnPicker}
                    placeholder="DD-MM-YYYY"
                    className="search-input with-icon with-picker-btn"
                    pattern="[0-9]{2}-[0-9]{2}-[0-9]{4}"
                    autoComplete="off"
                    required
                  />
                  <div className="calendar-picker-trigger">
                    <button
                      type="button"
                      className="calendar-icon-btn"
                      onClick={openReturnPicker}
                      title="Select return date"
                      aria-label="Select return date"
                    >
                      <Calendar size={16} />
                    </button>
                    <input
                      ref={returnInputRef}
                      type="date"
                      min={searchParams.pickupDate || DEFAULT_TODAY}
                      value={searchParams.returnDate}
                      onChange={handleReturnPickerChange}
                      className="native-date-hidden-overlay"
                      tabIndex={-1}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </div>

              {/* 6. Return Time */}
              <div className="form-group">
                <label htmlFor="returnTime">Return Time</label>
                <div className="input-with-icon">
                  <Clock size={16} className="field-icon" />
                  <input
                    type="time"
                    id="returnTime"
                    name="returnTime"
                    value={searchParams.returnTime}
                    onChange={handleInputChange}
                    className="search-input with-icon"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Submit Action */}
            <div className="search-action-row">
              <button type="submit" className="btn btn-primary search-submit-btn">
                <Search size={18} />
                <span>Search Vehicles</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
