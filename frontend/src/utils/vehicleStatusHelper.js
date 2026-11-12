/**
 * Shared availability status formatting and booking eligibility rules.
 */

export const AVAILABILITY_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'maintenance', label: 'Under Maintenance' },
  { value: 'unavailable', label: 'Unavailable' },
  { value: 'out_of_stock', label: 'Out of Stock' }
]

export const ALL_STATUS_LABELS = {
  available: 'Available',
  demo: 'Demo – Not Available for Booking',
  status_unknown: 'Availability Unverified',
  loading: 'Checking Availability...',
  maintenance: 'Under Maintenance',
  unavailable: 'Unavailable',
  out_of_stock: 'Out of Stock',
  booked: 'Booked',
  rented: 'Rented',
  decommissioned: 'Decommissioned'
}

export const BOOKING_BLOCKED_STATUSES = new Set([
  'demo',
  'status_unknown',
  'loading',
  'booked',
  'rented',
  'maintenance',
  'unavailable',
  'out_of_stock',
  'decommissioned'
])

export const normaliseAvailabilityStatus = (status) => {
  const s = String(status || '').trim().toLowerCase()
  if (s === 'catalog' || s === 'catalogue' || s === 'demo') return 'demo'
  if (s === '') return 'available'
  return s
}

export const getAvailabilityLabel = (status) => {
  const norm = normaliseAvailabilityStatus(status)
  return ALL_STATUS_LABELS[norm] || (norm.charAt(0).toUpperCase() + norm.slice(1).replace(/_/g, ' '))
}

export const getAvailabilityClass = (status) => {
  return normaliseAvailabilityStatus(status).replace(/_/g, '-')
}

export const isStatusBookingBlocked = (status) => {
  const norm = normaliseAvailabilityStatus(status)
  return BOOKING_BLOCKED_STATUSES.has(norm) || norm !== 'available'
}

export const getBookingUnavailableReason = (status) => {
  const norm = normaliseAvailabilityStatus(status)
  if (norm === 'demo') {
    return 'Demo – Not Available for Booking. This model is shown for catalogue demonstration only.'
  }
  if (norm === 'status_unknown') {
    return 'Live fleet availability could not be verified right now. Please retry before booking.'
  }
  if (norm === 'loading') {
    return 'Checking live fleet availability...'
  }
  if (norm === 'booked') {
    return 'This vehicle is currently booked and cannot be booked at this time.'
  }
  if (norm === 'rented') {
    return 'This vehicle is currently rented out and cannot be booked at this time.'
  }
  if (norm === 'maintenance') {
    return 'This vehicle is currently under maintenance and cannot be booked.'
  }
  if (norm === 'out_of_stock') {
    return 'This vehicle is currently out of stock and cannot be booked.'
  }
  if (norm === 'unavailable') {
    return 'This vehicle is currently marked unavailable by fleet operations.'
  }
  if (norm === 'decommissioned') {
    return 'This vehicle has been decommissioned and is no longer available for rent.'
  }
  if (norm !== 'available') {
    return 'This vehicle is currently not available for booking.'
  }
  return ''
}

const DB_ID_TO_CATALOG_ID = {
  1: 'car-tata-nexon-ev',
  2: 'car-hyundai-creta',
  3: 'bike-yamaha-r15',
  4: 'bike-royal-enfield-hunter-350',
  5: 'scooty-ather-450x',
  6: 'scooty-honda-activa-6g',
  7: 'utility-tata-ace-ev',
  8: 'utility-mahindra-bolero-pikup'
}

/**
 * Strictly match a database vehicle row to its corresponding static catalog entry
 * without ambiguous substring collisions (e.g. Bolero variants or Activa variants).
 */
export const matchDbVehicleToCatalog = (dbVehicle, catalogList = []) => {
  if (!dbVehicle) return null

  const featureCatalogId = dbVehicle.features?.catalog_id
  if (featureCatalogId) {
    const exactByFeature = catalogList.find((c) => c.id === featureCatalogId)
    if (exactByFeature) return exactByFeature
  }

  const mappedId = DB_ID_TO_CATALOG_ID[Number(dbVehicle.id)]
  if (mappedId) {
    const mappedCatalog = catalogList.find((c) => c.id === mappedId)
    if (mappedCatalog) return mappedCatalog
  }

  const makeL = (dbVehicle.make || '').toLowerCase().trim()
  const modelL = (dbVehicle.model || '').toLowerCase().trim()
  if (!makeL || !modelL) return null

  return catalogList.find((c) => {
    const cBrand = c.brand.toLowerCase().trim()
    const cModel = c.model.toLowerCase().trim()
    const brandMatches = cBrand === makeL || (cBrand.startsWith(makeL) && makeL.length >= 4) || (makeL.startsWith(cBrand) && cBrand.length >= 4)
    return brandMatches && cModel === modelL
  }) || null
}

/**
 * Find the live database unit matching a catalog model entry.
 */
export const findMatchingDbUnit = (catalogModel, dbList = []) => {
  if (!catalogModel || !Array.isArray(dbList)) return null
  const matches = dbList.filter((dbV) => {
    if (dbV.features?.catalog_id === catalogModel.id) return true
    if (DB_ID_TO_CATALOG_ID[Number(dbV.id)] === catalogModel.id) return true
    const makeL = (dbV.make || '').toLowerCase().trim()
    const modelL = (dbV.model || '').toLowerCase().trim()
    const cBrand = (catalogModel.brand || '').toLowerCase().trim()
    const cModel = (catalogModel.model || '').toLowerCase().trim()
    const brandMatches = cBrand === makeL || (cBrand.startsWith(makeL) && makeL.length >= 4) || (makeL.startsWith(cBrand) && cBrand.length >= 4)
    return brandMatches && cModel === modelL
  })
  if (matches.length === 0) return null
  return matches.find((u) => normaliseAvailabilityStatus(u.availability_status) === 'available') || matches[0]
}
