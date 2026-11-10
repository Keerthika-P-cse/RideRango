import { Router } from 'express'
import {
  getBrands,
  getCategories,
  getVehicleById,
  getVehicles
} from '../controllers/vehicleController.js'

const router = Router()

// Vehicle routes
router.get('/vehicles', getVehicles)
router.get('/vehicles/:id', getVehicleById)
router.get('/categories', getCategories)
router.get('/brands', getBrands)

export default router
