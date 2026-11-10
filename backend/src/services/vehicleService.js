import { getPool } from '../config/db.js'

/**
 * Normalise category slug between UI names and database slugs
 */
const normaliseCategorySlug = (slug) => {
  if (!slug || slug === 'all') return null
  const lower = slug.toLowerCase()
  if (lower === 'scooties') return 'scooters'
  if (lower === 'utility') return 'commercial'
  return lower
}

/**
 * Map vehicle to primary display image and price tier
 */
export const enrichVehicleData = (v) => {
  const modelLower = (v.model || '').toLowerCase()
  const makeLower = (v.make || '').toLowerCase()

  let image = '/images/category-cars.jpg'
  if (modelLower.includes('nexon')) image = '/images/vehicle-nexon-ev.jpg'
  else if (modelLower.includes('creta')) image = '/images/vehicle-creta.jpg'
  else if (modelLower.includes('thar')) image = '/images/vehicle-thar.jpg'
  else if (modelLower.includes('innova')) image = '/images/vehicle-innova.jpg'
  else if (modelLower.includes('swift') || modelLower.includes('baleno') || modelLower.includes('tiago')) image = '/images/vehicle-swift.jpg'
  else if (modelLower.includes('dzire') || modelLower.includes('verna') || modelLower.includes('city') || modelLower.includes('tigor')) image = '/images/vehicle-sedan.jpg'
  else if (modelLower.includes('brezza')) image = '/images/vehicle-brezza.jpg'
  else if (makeLower.includes('maruti')) image = '/images/vehicle-swift.jpg'
  else if (modelLower.includes('r15')) image = '/images/vehicle-r15.jpg'
  else if (modelLower.includes('classic') || modelLower.includes('hunter') || makeLower.includes('royal')) image = '/images/vehicle-classic350.jpg'
  else if (modelLower.includes('pulsar')) image = '/images/vehicle-pulsar.jpg'
  else if (modelLower.includes('ather') || modelLower.includes('450x')) image = '/images/vehicle-ather450x.jpg'
  else if (modelLower.includes('activa')) image = '/images/vehicle-activa.jpg'
  else if (modelLower.includes('ntorq') || modelLower.includes('dio')) image = '/images/vehicle-ntorq.jpg'
  else if (modelLower.includes('jupiter')) image = '/images/vehicle-jupiter.jpg'
  else if (modelLower.includes('ace')) image = '/images/vehicle-ace-ev.jpg'
  else if (modelLower.includes('bolero') || modelLower.includes('intra') || modelLower.includes('pikup') || modelLower.includes('pickup')) image = '/images/vehicle-bolero-pikup.jpg'
  else if (modelLower.includes('winger') || modelLower.includes('urbania') || modelLower.includes('traveller')) image = '/images/vehicle-winger.jpg'
  else if (v.category_slug === 'bikes') image = '/images/category-bikes.jpg'
  else if (v.category_slug === 'scooters') image = '/images/category-scooties.jpg'
  else if (v.category_slug === 'commercial') image = '/images/category-utility.jpg'

  // Determine price tier
  const rate = parseFloat(v.daily_rate)
  let priceCategory = 'Affordable'
  if (rate >= 3000) priceCategory = 'Premium'
  else if (rate >= 1500) priceCategory = 'Medium-priced'

  return {
    ...v,
    daily_rate: rate,
    hourly_rate: v.hourly_rate ? parseFloat(v.hourly_rate) : null,
    security_deposit: parseFloat(v.security_deposit || 0),
    priceCategory,
    image,
    features: typeof v.features_json === 'string' ? JSON.parse(v.features_json) : v.features_json || {}
  }
}

export const vehicleService = {
  /**
   * Fetch all active vehicles with optional filtering and sorting
   */
  async getVehicles(filters = {}) {
    const pool = getPool()
    const conditions = ['v.is_active = TRUE']
    const params = []

    const categorySlug = normaliseCategorySlug(filters.category)
    if (categorySlug) {
      conditions.push('vc.slug = ?')
      params.push(categorySlug)
    }

    if (filters.brand) {
      conditions.push('LOWER(v.make) = LOWER(?)')
      params.push(filters.brand)
    }

    if (filters.fuelType) {
      conditions.push('LOWER(v.fuel_type) = LOWER(?)')
      params.push(filters.fuelType)
    }

    if (filters.transmission) {
      conditions.push('LOWER(v.transmission) = LOWER(?)')
      params.push(filters.transmission)
    }

    if (filters.seatingCapacity) {
      conditions.push('v.seating_capacity = ?')
      params.push(parseInt(filters.seatingCapacity, 10))
    }

    if (filters.minPrice) {
      conditions.push('v.daily_rate >= ?')
      params.push(parseFloat(filters.minPrice))
    }

    if (filters.maxPrice) {
      conditions.push('v.daily_rate <= ?')
      params.push(parseFloat(filters.maxPrice))
    }

    if (filters.search) {
      conditions.push('(LOWER(v.make) LIKE ? OR LOWER(v.model) LIKE ? OR LOWER(v.location) LIKE ?)')
      const searchParam = `%${filters.search.toLowerCase()}%`
      params.push(searchParam, searchParam, searchParam)
    }

    // Sorting
    let orderBy = 'ORDER BY v.id ASC'
    if (filters.sort === 'price_asc') {
      orderBy = 'ORDER BY v.daily_rate ASC'
    } else if (filters.sort === 'price_desc') {
      orderBy = 'ORDER BY v.daily_rate DESC'
    } else if (filters.sort === 'name_asc') {
      orderBy = 'ORDER BY v.make ASC, v.model ASC'
    }

    const sql = `
      SELECT 
        v.*,
        vc.name AS category_name,
        vc.slug AS category_slug
      FROM vehicles v
      JOIN vehicle_categories vc ON v.category_id = vc.id
      WHERE ${conditions.join(' AND ')}
      ${orderBy}
    `

    const [rows] = await pool.query(sql, params)
    return rows.map(enrichVehicleData)
  },

  /**
   * Fetch a single vehicle by ID
   */
  async getVehicleById(id) {
    const pool = getPool()
    const sql = `
      SELECT 
        v.*,
        vc.name AS category_name,
        vc.slug AS category_slug
      FROM vehicles v
      JOIN vehicle_categories vc ON v.category_id = vc.id
      WHERE v.id = ? AND v.is_active = TRUE
      LIMIT 1
    `
    const [rows] = await pool.query(sql, [id])
    if (rows.length === 0) return null
    return enrichVehicleData(rows[0])
  },

  /**
   * Fetch all active vehicle categories
   */
  async getCategories() {
    const pool = getPool()
    const sql = `
      SELECT id, name, slug, description, base_deposit_amount
      FROM vehicle_categories
      WHERE is_active = TRUE
      ORDER BY id ASC
    `
    const [rows] = await pool.query(sql)
    return rows.map(r => ({
      ...r,
      base_deposit_amount: parseFloat(r.base_deposit_amount)
    }))
  },

  /**
   * Fetch distinct vehicle brands/makes
   */
  async getBrands(categorySlug = null) {
    const pool = getPool()
    const norm = normaliseCategorySlug(categorySlug)
    let sql = `
      SELECT DISTINCT v.make
      FROM vehicles v
      JOIN vehicle_categories vc ON v.category_id = vc.id
      WHERE v.is_active = TRUE
    `
    const params = []
    if (norm) {
      sql += ' AND vc.slug = ?'
      params.push(norm)
    }
    sql += ' ORDER BY v.make ASC'
    const [rows] = await pool.query(sql, params)
    return rows.map(r => r.make)
  }
}
