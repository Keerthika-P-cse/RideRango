import { useState, useEffect } from 'react'
import { Plus, Edit2, CheckCircle2, X, AlertCircle, Sparkles } from 'lucide-react'
import adminApi from '../../services/adminApi.js'
import { useAdminAuth } from '../../context/useAdminAuth.js'
import VehicleImage from '../../components/common/VehicleImage.jsx'
import { vehiclesData } from '../../data/vehiclesData.js'
import {
  AVAILABILITY_OPTIONS,
  getAvailabilityClass,
  getAvailabilityLabel
} from '../../utils/vehicleStatusHelper.js'
import './AdminVehiclesPage.css'

export default function AdminVehiclesPage() {
  const { isAdmin } = useAdminAuth()

  const [vehicles, setVehicles] = useState([])
  const [categories, setCategories] = useState([])
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [updatingStatusId, setUpdatingStatusId] = useState(null)

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Modal State
  const [modalMode, setModalMode] = useState(null) // 'add' | 'edit' | null
  const [formData, setFormData] = useState({
    id: null,
    category_id: 1,
    registration_number: '',
    make: '',
    model: '',
    year: 2024,
    color: '',
    fuel_type: 'petrol',
    transmission: 'manual',
    seating_capacity: 5,
    daily_rate: '',
    hourly_rate: '',
    security_deposit: 2000,
    availability_status: 'available',
    location: 'Main Hub',
    is_active: 1
  })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const loadData = async () => {
    setError('')
    try {
      const [vRes, cRes] = await Promise.all([
        adminApi.getVehicles(),
        adminApi.getCategories()
      ])
      if (vRes?.success && vRes.data) setVehicles(vRes.data)
      if (cRes?.success && cRes.data) setCategories(cRes.data)
    } catch (err) {
      setError(err.message || 'Failed to load vehicle inventory.')
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleOpenAddModal = () => {
    setFormData({
      id: null,
      category_id: categories[0]?.id || 1,
      registration_number: '',
      make: '',
      model: '',
      year: new Date().getFullYear(),
      color: '',
      fuel_type: 'petrol',
      transmission: 'manual',
      seating_capacity: 5,
      daily_rate: '',
      hourly_rate: '',
      security_deposit: 2000,
      availability_status: 'available',
      location: 'Main Hub - Indiranagar',
      is_active: 1
    })
    setFormError('')
    setModalMode('add')
  }

  const handleSelectCatalogModel = (e) => {
    const selectedId = e.target.value
    if (!selectedId) return

    const catModel = vehiclesData.find(v => v.id === selectedId)
    if (!catModel) return

    // Map category string to category_id
    // 1: Cars, 2: Bikes, 3: Scooters, 4: Commercial / Utility
    let catId = 1
    if (catModel.category === 'bikes') catId = 2
    else if (catModel.category === 'scooties') catId = 3
    else if (catModel.category === 'utility') catId = 4

    setFormData(prev => ({
      ...prev,
      category_id: catId,
      make: catModel.brand,
      model: catModel.model,
      daily_rate: catModel.pricePerDay,
      hourly_rate: Math.round(catModel.pricePerDay / 8),
      security_deposit: catModel.securityDeposit || 2000,
      fuel_type: (catModel.fuelType || 'petrol').toLowerCase(),
      transmission: (catModel.transmission || 'manual').toLowerCase(),
      seating_capacity: catModel.seatingCapacity || (catId === 1 ? 5 : 2),
      location: catModel.location || 'Main Hub - Indiranagar'
    }))
  }

  const handleOpenEditModal = (v) => {
    setFormData({
      id: v.id,
      category_id: v.category_id,
      registration_number: v.registration_number,
      make: v.make,
      model: v.model,
      year: v.year,
      color: v.color || '',
      fuel_type: v.fuel_type,
      transmission: v.transmission,
      seating_capacity: v.seating_capacity,
      daily_rate: v.daily_rate,
      hourly_rate: v.hourly_rate || '',
      security_deposit: v.security_deposit,
      availability_status: v.availability_status,
      location: v.location,
      is_active: v.is_active ? 1 : 0
    })
    setFormError('')
    setModalMode('edit')
  }

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (checked ? 1 : 0) : value
    }))
  }

  const handleFormSubmit = async (e) => {
    e.preventDefault()
    setFormError('')
    setSubmitting(true)

    try {
      if (modalMode === 'add') {
        const res = await adminApi.createVehicle(formData)
        if (res && res.success) {
          setSuccessMsg('Vehicle added successfully!')
          setModalMode(null)
          await loadData()
        }
      } else if (modalMode === 'edit') {
        const res = await adminApi.updateVehicle(formData.id, formData)
        if (res && res.success) {
          setSuccessMsg('Vehicle updated successfully!')
          setModalMode(null)
          await loadData()
        }
      }
    } catch (err) {
      setFormError(err.message || 'Error saving vehicle record.')
    } finally {
      setSubmitting(false)
    }
  }

  // Filter vehicles
  const handleStatusChange = async (vehicle, nextStatus) => {
    if (!nextStatus || nextStatus === vehicle.availability_status) return
    setError('')
    setSuccessMsg('')
    setUpdatingStatusId(vehicle.id)
    try {
      const res = await adminApi.updateVehicleAvailability(vehicle.id, nextStatus)
      if (res?.success && res.data) {
        setVehicles((prev) =>
          prev.map((item) => (item.id === vehicle.id ? { ...item, ...res.data } : item))
        )
        setSuccessMsg(
          `${vehicle.make} ${vehicle.model} (${vehicle.registration_number}) marked as ${getAvailabilityLabel(nextStatus)}.`
        )
      }
    } catch (err) {
      setError(err.message || 'Failed to update vehicle availability.')
    } finally {
      setUpdatingStatusId(null)
    }
  }

  const filteredVehicles = vehicles.filter((v) => {
    if (categoryFilter !== 'all' && String(v.category_id) !== String(categoryFilter)) {
      return false
    }
    if (statusFilter !== 'all' && v.availability_status !== statusFilter) {
      return false
    }
    return true
  })

  return (
    <div className="admin-vehicles-container">
      {/* Top Header */}
      <div className="veh-header-row">
        <div>
          <h1 className="dash-title">Manage Vehicles</h1>
          <p className="dash-sub">View and manage vehicles, rental prices and availability.</p>
        </div>

        {isAdmin && (
          <button type="button" onClick={handleOpenAddModal} className="btn-add-vehicle">
            <Plus size={16} />
            <span>Add Vehicle</span>
          </button>
        )}
      </div>

      {successMsg && (
        <div className="dash-success-banner">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg('')} className="btn-close-banner">&times;</button>
        </div>
      )}

      {error && (
        <div className="dash-error-banner">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="veh-filters-bar">
        <div className="filter-group">
          <label>Category:</label>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={`cat-filter-${c.id}`} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Status:</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value="available">Available</option>
            <option value="maintenance">Under Maintenance</option>
            <option value="unavailable">Unavailable</option>
            <option value="out_of_stock">Out of Stock</option>
            <option value="booked">Booked</option>
            <option value="rented">Rented</option>
          </select>
        </div>

        <span className="results-badge">Showing {filteredVehicles.length} of {vehicles.length} Units</span>
      </div>

      {/* Vehicles Table */}
      <div className="dash-section-card">
        <div className="table-responsive">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Vehicle Photo</th>
                <th>Make & Model</th>
                <th>Category</th>
                <th>Registration</th>
                <th>Daily Rate</th>
                <th>Deposit</th>
                <th>Availability</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVehicles.length > 0 ? (
                filteredVehicles.map((v) => (
                  <tr key={v.id} className={!v.is_active ? 'row-deactivated' : ''}>
                    <td>
                      <VehicleImage
                        vehicle={v}
                        src={v.image}
                        alt={`${v.make} ${v.model}`}
                        className="admin-veh-thumb"
                      />
                    </td>
                    <td>
                      <div className="cell-col">
                        <strong>{v.make} {v.model}</strong>
                        <span className="cell-sub">{v.year} &bull; {v.fuel_type} &bull; {v.transmission}</span>
                      </div>
                    </td>
                    <td>
                      <span className="cat-badge">{v.category_name}</span>
                    </td>
                    <td>
                      <span className="cell-reg mono">{v.registration_number}</span>
                    </td>
                    <td>
                      <strong>₹{parseFloat(v.daily_rate).toLocaleString('en-IN')}</strong> / day
                    </td>
                    <td>
                      ₹{parseFloat(v.security_deposit).toLocaleString('en-IN')}
                    </td>
                    <td>
                      <span className={`status-pill status-pill-${getAvailabilityClass(v.availability_status)}`}>
                        {getAvailabilityLabel(v.availability_status)}
                      </span>
                    </td>
                    <td>
                      <span className={`status-dot ${v.is_active ? 'dot-active' : 'dot-inactive'}`}>
                        {v.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="veh-actions-cell">
                        <select
                          aria-label={`Change availability for ${v.make} ${v.model}`}
                          className="status-inline-select"
                          value={v.availability_status}
                          disabled={updatingStatusId === v.id}
                          onChange={(e) => handleStatusChange(v, e.target.value)}
                        >
                          {!AVAILABILITY_OPTIONS.some((o) => o.value === v.availability_status) && (
                            <option value={v.availability_status}>
                              {getAvailabilityLabel(v.availability_status)}
                            </option>
                          )}
                          {AVAILABILITY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(v)}
                            className="btn-tbl-action"
                            title="Edit Vehicle Details"
                          >
                            <Edit2 size={14} />
                            <span>Edit</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="empty-table-cell">No vehicles match the selected criteria.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT MODAL */}
      {modalMode && (
        <div className="modal-backdrop" onClick={() => setModalMode(null)}>
          <div className="modal-card-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modalMode === 'add' ? 'Add New Vehicle' : `Edit Vehicle #${formData.id}`}</h3>
              <button type="button" onClick={() => setModalMode(null)} className="btn-modal-close">
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div className="modal-error-box">
                <AlertCircle size={15} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="modal-form-grid">
              {modalMode === 'add' && (
                <div className="form-field catalogue-preset-field">
                  <label htmlFor="cat-model-preset-select" className="preset-label">
                    <Sparkles size={14} className="preset-sparkle" />
                    <span>Choose from Catalogue Models (Auto-fills specifications)</span>
                  </label>
                  <select
                    id="cat-model-preset-select"
                    onChange={handleSelectCatalogModel}
                    className="select-catalogue-preset"
                    defaultValue=""
                  >
                    <option value="">-- Select a Catalogue Model to Pre-fill --</option>
                    <optgroup label="Cars">
                      {vehiclesData.filter(v => v.category === 'cars').map(v => (
                        <option key={v.id} value={v.id}>{v.brand} {v.model} (₹{v.pricePerDay}/day)</option>
                      ))}
                    </optgroup>
                    <optgroup label="Bikes">
                      {vehiclesData.filter(v => v.category === 'bikes').map(v => (
                        <option key={v.id} value={v.id}>{v.brand} {v.model} (₹{v.pricePerDay}/day)</option>
                      ))}
                    </optgroup>
                    <optgroup label="Scooties">
                      {vehiclesData.filter(v => v.category === 'scooties').map(v => (
                        <option key={v.id} value={v.id}>{v.brand} {v.model} (₹{v.pricePerDay}/day)</option>
                      ))}
                    </optgroup>
                    <optgroup label="Utility Vehicles">
                      {vehiclesData.filter(v => v.category === 'utility').map(v => (
                        <option key={v.id} value={v.id}>{v.brand} {v.model} (₹{v.pricePerDay}/day)</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              )}

              <div className="form-row-2">
                <div className="form-field">
                  <label>Category *</label>
                  <select name="category_id" value={formData.category_id} onChange={handleFormChange} required>
                    {categories.map((c) => (
                      <option key={`cat-modal-${c.id}`} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-field">
                  <label>Registration Number *</label>
                  <input
                    name="registration_number"
                    type="text"
                    required
                    placeholder="KA-01-AB-1234"
                    value={formData.registration_number}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-field">
                  <label>Make / Brand *</label>
                  <input
                    name="make"
                    type="text"
                    required
                    placeholder="e.g. Tata, Hyundai, Yamaha"
                    value={formData.make}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="form-field">
                  <label>Model *</label>
                  <input
                    name="model"
                    type="text"
                    required
                    placeholder="e.g. Nexon EV, R15, Ace EV"
                    value={formData.model}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              <div className="form-row-3">
                <div className="form-field">
                  <label>Year *</label>
                  <input
                    name="year"
                    type="number"
                    required
                    value={formData.year}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="form-field">
                  <label>Fuel Type *</label>
                  <select name="fuel_type" value={formData.fuel_type} onChange={handleFormChange}>
                    <option value="petrol">Petrol</option>
                    <option value="diesel">Diesel</option>
                    <option value="electric">Electric</option>
                    <option value="cng">CNG</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>Transmission *</label>
                  <select name="transmission" value={formData.transmission} onChange={handleFormChange}>
                    <option value="manual">Manual</option>
                    <option value="automatic">Automatic</option>
                  </select>
                </div>
              </div>

              <div className="form-row-3">
                <div className="form-field">
                  <label>Daily Rate (₹) *</label>
                  <input
                    name="daily_rate"
                    type="number"
                    step="0.01"
                    required
                    placeholder="1999.00"
                    value={formData.daily_rate}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="form-field">
                  <label>Security Deposit (₹) *</label>
                  <input
                    name="security_deposit"
                    type="number"
                    step="0.01"
                    required
                    placeholder="2000.00"
                    value={formData.security_deposit}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="form-field">
                  <label>Seats *</label>
                  <input
                    name="seating_capacity"
                    type="number"
                    required
                    value={formData.seating_capacity}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-field">
                  <label>Availability Status *</label>
                  <select name="availability_status" value={formData.availability_status} onChange={handleFormChange}>
                    <option value="available">Available</option>
                    <option value="maintenance">Under Maintenance</option>
                    <option value="unavailable">Unavailable</option>
                    <option value="out_of_stock">Out of Stock</option>
                    <option value="booked">Booked</option>
                    <option value="rented">Rented</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>Hub Location *</label>
                  <input
                    name="location"
                    type="text"
                    required
                    value={formData.location}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              <div className="form-checkbox-row">
                <label className="checkbox-label">
                  <input
                    name="is_active"
                    type="checkbox"
                    checked={Boolean(formData.is_active)}
                    onChange={handleFormChange}
                  />
                  <span>Active and visible to customers</span>
                </label>
              </div>

              <div className="modal-actions-row">
                <button type="button" onClick={() => setModalMode(null)} className="btn-modal-cancel">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-modal-submit">
                  {submitting ? 'Saving...' : (modalMode === 'add' ? 'Create Vehicle' : 'Save Changes')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
