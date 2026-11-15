import { Router } from 'express'
import healthRoutes from './healthRoutes.js'
import vehicleRoutes from './vehicleRoutes.js'
import authRoutes from './authRoutes.js'
import bookingRoutes from './bookingRoutes.js'
import paymentRoutes from './paymentRoutes.js'
import adminRoutes from './adminRoutes.js'
import documentRoutes from './documentRoutes.js'
import agreementRoutes from './agreementRoutes.js'
import handoverRoutes from './handoverRoutes.js'

const apiRouter = Router()

// Health Check
apiRouter.use('/', healthRoutes)

// Vehicles
apiRouter.use('/', vehicleRoutes)

// Authentication
apiRouter.use('/auth', authRoutes)

// Bookings
apiRouter.use('/', bookingRoutes)

// Payments
apiRouter.use('/', paymentRoutes)

// Phase 7: Staff & Admin Management
apiRouter.use('/admin', adminRoutes)

// Documents (Demo Driving Licence Verification)
apiRouter.use('/documents', documentRoutes)

// Phase 4: Agreements (Demo Rental Agreement Acceptance)
apiRouter.use('/agreements', agreementRoutes)

// Phase 5: Handovers (Demo Vehicle Handover Workflow)
apiRouter.use('/handovers', handoverRoutes)

export default apiRouter
