import { vehiclesData as catalogVehicles } from '../data/vehiclesData.js'

// Helper to get fallback category image based on vehicle category
export const getCategoryFallbackImage = (vehicle) => {
  if (!vehicle) return '/images/category-cars.jpg'
  const cat = (vehicle.category_slug || vehicle.category || vehicle.categoryName || vehicle.category_name || '').toLowerCase()
  const catId = Number(vehicle.category_id)
  const model = (vehicle.model || vehicle.name || '').toLowerCase()

  if (catId === 4 || cat.includes('utility') || cat.includes('commercial') || model.includes('ace') || model.includes('truck') || model.includes('bolero') || model.includes('winger')) {
    return '/images/category-utility.jpg'
  }
  if (catId === 2 || cat.includes('bike') || model.includes('r15') || model.includes('pulsar') || model.includes('hunter') || model.includes('classic') || model.includes('bullet') || model.includes('enfield') || model.includes('apache')) {
    return '/images/category-bikes.jpg'
  }
  if (catId === 3 || cat.includes('scoot') || model.includes('activa') || model.includes('ather') || model.includes('ntorq') || model.includes('jupiter') || model.includes('dio') || model.includes('ola')) {
    return '/images/category-scooties.jpg'
  }
  return '/images/category-cars.jpg'
}

// Helper to resolve stable vehicle image
export const resolveVehicleImage = (vehicle, explicitSrc = '') => {
  if (explicitSrc && typeof explicitSrc === 'string' && explicitSrc.trim() !== '') {
    return explicitSrc
  }

  if (vehicle && vehicle.image && typeof vehicle.image === 'string' && vehicle.image.trim() !== '') {
    return vehicle.image
  }

  if (vehicle) {
    const modelLower = (vehicle.model || vehicle.name || '').toLowerCase()
    const makeLower = (vehicle.make || vehicle.brand || '').toLowerCase()

    // 1. Direct model check
    if (modelLower.includes('ace')) return '/images/vehicle-ace-ev.jpg'
    if (modelLower.includes('creta')) return '/images/vehicle-creta.jpg'
    if (modelLower.includes('nexon')) return '/images/vehicle-nexon-ev.jpg'
    if (modelLower.includes('r15')) return '/images/vehicle-r15.jpg'
    if (modelLower.includes('hunter') || modelLower.includes('classic')) return '/images/vehicle-classic350.jpg'
    if (modelLower.includes('ather') || modelLower.includes('450x')) return '/images/vehicle-ather450x.jpg'
    if (modelLower.includes('activa')) return '/images/vehicle-activa.jpg'
    if (modelLower.includes('bolero')) return '/images/vehicle-bolero-pikup.jpg'
    if (modelLower.includes('swift')) return '/images/vehicle-swift.jpg'
    if (modelLower.includes('innova')) return '/images/vehicle-innova.jpg'
    if (modelLower.includes('thar')) return '/images/vehicle-thar.jpg'
    if (modelLower.includes('brezza')) return '/images/vehicle-brezza.jpg'
    if (modelLower.includes('ntorq')) return '/images/vehicle-ntorq.jpg'
    if (modelLower.includes('jupiter')) return '/images/vehicle-jupiter.jpg'
    if (modelLower.includes('pulsar')) return '/images/vehicle-pulsar.jpg'
    if (modelLower.includes('winger')) return '/images/vehicle-winger.jpg'
    if (modelLower.includes('sedan') || modelLower.includes('verna') || modelLower.includes('city') || modelLower.includes('ciaz')) return '/images/vehicle-sedan.jpg'

    // 2. Catalog lookup
    const found = catalogVehicles.find((c) => {
      const cBrand = c.brand.toLowerCase()
      const cModel = c.model.toLowerCase()
      return (
        (cBrand.includes(makeLower) || makeLower.includes(cBrand)) &&
        (cModel.includes(modelLower) || modelLower.includes(cModel))
      )
    })
    if (found && found.image) return found.image
  }

  return getCategoryFallbackImage(vehicle)
}
