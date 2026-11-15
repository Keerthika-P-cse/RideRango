import { Router } from 'express'
import {
  uploadDrivingLicence,
  getDocumentStatus,
  getAdminDocuments,
  verifyAdminDocument,
  serveDocumentFile
} from '../controllers/documentController.js'
import { requireCustomerAuth, requireStaffAuth } from '../middleware/authMiddleware.js'

const router = Router()

// Customer Routes
router.post('/upload', requireCustomerAuth, uploadDrivingLicence)
router.get('/status/:bookingId', requireCustomerAuth, getDocumentStatus)

// Staff/Admin Routes
router.get('/admin/list', requireStaffAuth, getAdminDocuments)
router.put('/admin/:bookingId/verify', requireStaffAuth, verifyAdminDocument)

// Serve Document Image Files
router.get('/file/:filename', serveDocumentFile)

export default router
