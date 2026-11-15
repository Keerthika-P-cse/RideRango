import { useState, useEffect, useRef } from 'react'
import {
  X,
  Upload,
  CheckCircle,
  AlertCircle,
  Clock,
  ShieldCheck,
  RefreshCw,
  FileImage,
  Info
} from 'lucide-react'
import api from '../../services/api.js'
import './DrivingLicenceModal.css'

export default function DrivingLicenceModal({
  isOpen,
  onClose,
  booking,
  onStatusUpdated
}) {
  const [status, setStatus] = useState('not_submitted')
  const [rejectionReason, setRejectionReason] = useState('')
  const [frontImage, setFrontImage] = useState(null)
  const [backImage, setBackImage] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const frontInputRef = useRef(null)
  const backInputRef = useRef(null)

  // Fetch document status when modal opens
  useEffect(() => {
    if (!isOpen || !booking?.id) return

    let isMounted = true
    setErrorMsg('')
    setSuccessMsg('')

    api.getDocumentStatus(booking.id)
      .then((res) => {
        if (isMounted && res.success && res.data) {
          setStatus(res.data.status || 'not_submitted')
          setRejectionReason(res.data.rejection_reason || '')
          if (res.data.front_url) setFrontImage(res.data.front_url)
          if (res.data.back_url) setBackImage(res.data.back_url)
        }
      })
      .catch((err) => {
        console.warn('Failed to load document status:', err)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, booking?.id])

  if (!isOpen || !booking) return null

  // Handle local file selection
  const handleFileChange = (e, side) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate type: JPG, JPEG, PNG
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png']
    if (!validTypes.includes(file.type.toLowerCase())) {
      setErrorMsg('Please select a valid image file (JPG, JPEG, or PNG).')
      return
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image size must be less than 5MB.')
      return
    }

    setErrorMsg('')
    const reader = new FileReader()
    reader.onload = (event) => {
      if (side === 'front') {
        setFrontImage(event.target.result)
      } else {
        setBackImage(event.target.result)
      }
    }
    reader.readAsDataURL(file)
  }

  // Pre-fill demo sample licence images (College presentation convenience)
  const handleFillDemoLicence = () => {
    setErrorMsg('')
    setFrontImage('/images/demo-dl-front.svg')
    setBackImage('/images/demo-dl-back.svg')
    setSuccessMsg('Loaded sample demo licence images. Click "Submit Documents" to proceed.')
  }

  // Submit documents
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!frontImage || !backImage) {
      setErrorMsg('Please provide both Front Side and Back Side images.')
      return
    }

    setSubmitting(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      const payload = {
        booking_id: booking.id,
        front_image: frontImage,
        back_image: backImage,
        document_number: booking.driving_license_number || 'DL-DEMO'
      }

      const res = await api.uploadDrivingLicence(payload)
      if (res.success) {
        setStatus('pending')
        setRejectionReason('')
        setSuccessMsg('Documents submitted successfully. Status is now Pending Staff Verification.')
        if (onStatusUpdated) onStatusUpdated('pending')
      } else {
        setErrorMsg(res.message || 'Submission failed.')
      }
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit documents. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const isEditable = status === 'not_submitted' || status === 'rejected'

  return (
    <div className="dl-modal-backdrop" onClick={onClose}>
      <div className="dl-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="dl-modal-header">
          <div className="dl-header-title-group">
            <h3>Driving Licence Verification</h3>
            <p>
              Booking Ref: <strong>{booking.booking_reference}</strong> &bull; Vehicle: {booking.make} {booking.model}
            </p>
          </div>
          <button type="button" onClick={onClose} className="dl-btn-close" aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {/* Demo Watermark Banner */}
        <div className="dl-demo-banner">
          <div className="dl-demo-banner-text">
            <Info size={16} />
            <span>COLLEGE PROJECT DEMO &bull; NOT A REAL IDENTITY VERIFICATION SYSTEM</span>
          </div>
          {isEditable && (
            <button
              type="button"
              onClick={handleFillDemoLicence}
              className="dl-btn-sample-fill"
              title="Populate fictional demo licence images"
            >
              Use Demo Licence
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="dl-modal-body">
          {/* Status Display Banner */}
          <div className={`dl-status-banner status-${status}`}>
            {status === 'accepted' || status === 'verified' ? (
              <CheckCircle size={20} className="status-icon" />
            ) : status === 'rejected' ? (
              <AlertCircle size={20} className="status-icon" />
            ) : status === 'pending' ? (
              <Clock size={20} className="status-icon" />
            ) : (
              <FileImage size={20} className="status-icon" />
            )}

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <strong>Document Status:</strong>
                <span className={`dl-status-badge badge-${status}`}>
                  {status === 'not_submitted' ? 'Not Submitted' : status}
                </span>
              </div>

              {status === 'not_submitted' && (
                <p style={{ margin: 0, fontSize: '0.8125rem' }}>
                  Please upload clear front and back photos of your Driving Licence before vehicle handover.
                </p>
              )}
              {status === 'pending' && (
                <p style={{ margin: 0, fontSize: '0.8125rem' }}>
                  Your documents have been submitted and are awaiting staff review.
                </p>
              )}
              {(status === 'accepted' || status === 'verified') && (
                <p style={{ margin: 0, fontSize: '0.8125rem' }}>
                  Your Driving Licence has been accepted and verified for this booking.
                </p>
              )}
              {status === 'rejected' && (
                <div style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem' }}>
                  <p style={{ margin: '0 0 0.25rem', fontWeight: 600 }}>Rejection Reason:</p>
                  <p style={{ margin: 0, color: '#991b1b' }}>{rejectionReason || 'Document images were unclear or unreadable. Please re-upload clearer photos.'}</p>
                </div>
              )}
            </div>
          </div>

          {/* Feedback messages */}
          {errorMsg && (
            <div className="dl-status-banner status-rejected" style={{ padding: '0.6rem 0.8rem' }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="dl-status-banner status-accepted" style={{ padding: '0.6rem 0.8rem' }}>
              <CheckCircle size={16} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Image Upload Slots */}
          <div className="dl-upload-grid">
            {/* FRONT SIDE */}
            <div className={`dl-upload-box ${frontImage ? 'has-preview' : ''}`}>
              <span className="dl-side-label">Front Side (Photo &amp; Details)</span>

              {frontImage ? (
                <>
                  <div className="dl-preview-wrapper">
                    <img src={frontImage} alt="Driving Licence Front Preview" className="dl-preview-img" />
                  </div>
                  {isEditable && (
                    <button
                      type="button"
                      onClick={() => frontInputRef.current?.click()}
                      className="dl-btn-replace"
                    >
                      Replace Front Image
                    </button>
                  )}
                </>
              ) : (
                <div className="dl-upload-empty" onClick={() => frontInputRef.current?.click()}>
                  <Upload size={28} className="dl-upload-icon" />
                  <span className="dl-upload-text">Upload Front Side</span>
                  <span className="dl-upload-subtext">JPG, JPEG or PNG (Max 5MB)</span>
                </div>
              )}

              <input
                ref={frontInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                onChange={(e) => handleFileChange(e, 'front')}
                className="dl-file-input"
              />
            </div>

            {/* BACK SIDE */}
            <div className={`dl-upload-box ${backImage ? 'has-preview' : ''}`}>
              <span className="dl-side-label">Back Side (Endorsements &amp; Address)</span>

              {backImage ? (
                <>
                  <div className="dl-preview-wrapper">
                    <img src={backImage} alt="Driving Licence Back Preview" className="dl-preview-img" />
                  </div>
                  {isEditable && (
                    <button
                      type="button"
                      onClick={() => backInputRef.current?.click()}
                      className="dl-btn-replace"
                    >
                      Replace Back Image
                    </button>
                  )}
                </>
              ) : (
                <div className="dl-upload-empty" onClick={() => backInputRef.current?.click()}>
                  <Upload size={28} className="dl-upload-icon" />
                  <span className="dl-upload-text">Upload Back Side</span>
                  <span className="dl-upload-subtext">JPG, JPEG or PNG (Max 5MB)</span>
                </div>
              )}

              <input
                ref={backInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                onChange={(e) => handleFileChange(e, 'back')}
                className="dl-file-input"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="dl-modal-footer">
          <button type="button" onClick={onClose} className="dl-btn-cancel">
            Close
          </button>

          {isEditable && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !frontImage || !backImage}
              className="dl-btn-submit"
            >
              {submitting ? (
                <>
                  <RefreshCw size={15} className="spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={16} />
                  <span>{status === 'rejected' ? 'Resubmit Documents' : 'Submit Documents'}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
