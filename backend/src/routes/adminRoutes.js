import { Router } from 'express'
import {
  loginStaff,
  registerStaff,
  getStaffProfile,
  getDashboardStats,
  getVehicleCategories,
  getAdminVehicles,
  createAdminVehicle,
  updateAdminVehicle,
  getAdminBookings,
  updateBookingStatus,
  getAdminCustomers,
  getCustomerBookingsHistory,
  getAdminPayments,
  getAdminStaffList,
  createAdminStaff,
  toggleStaffStatus,
  updateStaffApproval
} from '../controllers/adminController.js'
import { requireStaffAuth, requireAdmin } from '../middleware/authMiddleware.js'
import { staffLoginLimiter } from '../middleware/rateLimiter.js'

const router = Router()

// Public Staff Auth
router.post('/auth/login', staffLoginLimiter, loginStaff)
router.post('/auth/register', staffLoginLimiter, registerStaff)

// Protected Staff Routes
router.get('/auth/me', requireStaffAuth, getStaffProfile)
router.get('/dashboard/stats', requireStaffAuth, getDashboardStats)
router.get('/categories', requireStaffAuth, getVehicleCategories)

// Vehicle Management
router.get('/vehicles', requireStaffAuth, getAdminVehicles)
router.post('/vehicles', requireStaffAuth, requireAdmin, createAdminVehicle)
router.put('/vehicles/:id', requireStaffAuth, requireAdmin, updateAdminVehicle)

// Booking Management
router.get('/bookings', requireStaffAuth, getAdminBookings)
router.put('/bookings/:id/status', requireStaffAuth, updateBookingStatus)

// Customer Management
router.get('/customers', requireStaffAuth, getAdminCustomers)
router.get('/customers/:id/bookings', requireStaffAuth, getCustomerBookingsHistory)

// Payment Management
router.get('/payments', requireStaffAuth, getAdminPayments)

// Staff Management (Admin Only)
router.get('/staff', requireStaffAuth, requireAdmin, getAdminStaffList)
router.post('/staff', requireStaffAuth, requireAdmin, createAdminStaff)
router.patch('/staff/:id/status', requireStaffAuth, requireAdmin, toggleStaffStatus)
router.patch('/staff/:id/approval', requireStaffAuth, requireAdmin, updateStaffApproval)

export default router
