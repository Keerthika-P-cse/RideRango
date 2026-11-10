import { vehicleService } from '../services/vehicleService.js'
import { sendError, sendSuccess } from '../utils/apiResponse.js'

export const getVehicles = async (req, res, next) => {
  try {
    const { category, brand, fuelType, transmission, seatingCapacity, minPrice, maxPrice, search, sort } = req.query
    const vehicles = await vehicleService.getVehicles({
      category,
      brand,
      fuelType,
      transmission,
      seatingCapacity,
      minPrice,
      maxPrice,
      search,
      sort
    })

    return sendSuccess(res, 'Vehicles retrieved successfully', {
      total: vehicles.length,
      vehicles
    })
  } catch (error) {
    next(error)
  }
}

export const getVehicleById = async (req, res, next) => {
  try {
    const { id } = req.params
    const vehicle = await vehicleService.getVehicleById(id)

    if (!vehicle) {
      return sendError(res, `Vehicle with ID ${id} was not found`, 404)
    }

    return sendSuccess(res, 'Vehicle details retrieved successfully', vehicle)
  } catch (error) {
    next(error)
  }
}

export const getCategories = async (_req, res, next) => {
  try {
    const categories = await vehicleService.getCategories()
    return sendSuccess(res, 'Vehicle categories retrieved successfully', categories)
  } catch (error) {
    next(error)
  }
}

export const getBrands = async (req, res, next) => {
  try {
    const { category } = req.query
    const brands = await vehicleService.getBrands(category)
    return sendSuccess(res, 'Vehicle brands retrieved successfully', brands)
  } catch (error) {
    next(error)
  }
}
