import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Search,
  X,
  FileText,
  Info
} from 'lucide-react'
import adminApi from '../../services/adminApi.js'
import './AdminDocumentsPage.css'

export default function AdminDocumentsPage() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all') // all | pending | accepted | rejected
  const [searchQuery, setSearchQuery] = useState('')
  const [processingId, setProcessingId] = useState(null)
  const [lightboxImage, setLightboxImage] = useState(null)

  // Rejection modal
  const [rejectingDoc, setRejectingDoc] = useState(null)
  const [rejectionReasonInput, setRejectionReasonInput] = useState('')

  const loadDocuments = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminApi.getAdminDocuments()
      if (res.success && Array.isArray(res.data)) {
        setDocuments(res.data)
      } else {
        setDocuments([])
      }
    } catch (err) {
      console.error('Failed to load admin documents:', err)
      setError(err.message || 'Failed to retrieve document verification list.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  // Handle Accept
  const handleAccept = async (doc) => {
    if (!doc.booking_id) return
    setProcessingId(doc.booking_id)
    try {
      const res = await adminApi.verifyAdminDocument(doc.booking_id, 'accept')
      if (res.success) {
        setDocuments((prev) =>
          prev.map((d) =>
            d.booking_id === doc.booking_id
              ? { ...d, status: 'accepted', raw_status: 'verified', rejection_reason: null }
              : d
          )
        )
      }
    } catch (err) {
      alert(`Accept failed: ${err.message}`)
    } finally {
      setProcessingId(null)
    }
  }

  // Open Reject Dialog
  const handleOpenReject = (doc) => {
    setRejectingDoc(doc)
    setRejectionReasonInput('Document image is blurry or expired.')
  }

  // Confirm Reject
  const handleConfirmReject = async () => {
    if (!rejectingDoc?.booking_id) return
    setProcessingId(rejectingDoc.booking_id)
    try {
      const res = await adminApi.verifyAdminDocument(
        rejectingDoc.booking_id,
        'reject',
        rejectionReasonInput
      )
      if (res.success) {
        setDocuments((prev) =>
          prev.map((d) =>
            d.booking_id === rejectingDoc.booking_id
              ? {
                  ...d,
                  status: 'rejected',
                  raw_status: 'rejected',
                  rejection_reason: rejectionReasonInput
                }
              : d
          )
        )
        setRejectingDoc(null)
      }
    } catch (err) {
      alert(`Reject failed: ${err.message}`)
    } finally {
      setProcessingId(null)
    }
  }

  // Filter & Search
  const filteredDocs = documents.filter((doc) => {
    if (filter === 'pending' && doc.status !== 'pending') return false
    if (filter === 'accepted' && doc.status !== 'accepted' && doc.status !== 'verified') return false
    if (filter === 'rejected' && doc.status !== 'rejected') return false

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchName = String(doc.customer_name || '').toLowerCase().includes(q)
      const matchRef = String(doc.booking_reference || '').toLowerCase().includes(q)
      const matchDl = String(doc.driving_license_number || '').toLowerCase().includes(q)
      return matchName || matchRef || matchDl
    }
    return true
  })

  const countPending = documents.filter((d) => d.status === 'pending').length
  const countAccepted = documents.filter((d) => d.status === 'accepted' || d.status === 'verified').length
  const countRejected = documents.filter((d) => d.status === 'rejected').length

  return (
    <div className="admin-docs-page">
      {/* Top Header */}
      <div className="admin-docs-header">
        <div>
          <h2>Driving Licence Verification</h2>
          <p>
            Review customer Driving Licences (Front &amp; Back) for vehicle handover verification.
          </p>
        </div>
        <button
          type="button"
          onClick={loadDocuments}
          disabled={loading}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
        >
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* College Project Demo Banner */}
      <div
        style={{
          background: '#eff6ff',
          borderLeft: '4px solid #3b82f6',
          padding: '0.75rem 1.25rem',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          fontSize: '0.8125rem',
          color: '#1e40af',
          fontWeight: 500
        }}
      >
        <Info size={16} />
        <span>
          DEMO WORKFLOW &bull; College Project Demonstration Feature &bull; Not a real government verification system
        </span>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="docs-filter-tabs">
          <button
            type="button"
            className={`docs-filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Submissions ({documents.length})
          </button>
          <button
            type="button"
            className={`docs-filter-tab ${filter === 'pending' ? 'active' : ''}`}
            onClick={() => setFilter('pending')}
          >
            Pending ({countPending})
          </button>
          <button
            type="button"
            className={`docs-filter-tab ${filter === 'accepted' ? 'active' : ''}`}
            onClick={() => setFilter('accepted')}
          >
            Accepted ({countAccepted})
          </button>
          <button
            type="button"
            className={`docs-filter-tab ${filter === 'rejected' ? 'active' : ''}`}
            onClick={() => setFilter('rejected')}
          >
            Rejected ({countRejected})
          </button>
        </div>

        <div style={{ position: 'relative', width: '280px' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search customer, ref or DL..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.45rem 0.75rem 0.45rem 2.2rem',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '0.8125rem'
            }}
          />
        </div>
      </div>

      {/* Error Feedback */}
      {error && (
        <div className="doc-rejection-alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Grid of Submissions */}
      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
          <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.5rem' }} />
          <p>Loading document submissions...</p>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#64748b' }}>
          <FileText size={32} style={{ margin: '0 auto 0.5rem', color: '#cbd5e1' }} />
          <h4>No Driving Licence Submissions Found</h4>
          <p style={{ fontSize: '0.875rem' }}>
            {filter !== 'all' ? `No documents currently marked as "${filter}".` : 'Customers have not yet submitted any driving licence photos for verification.'}
          </p>
        </div>
      ) : (
        <div className="admin-docs-grid">
          {filteredDocs.map((doc) => {
            const isAccepted = doc.status === 'accepted' || doc.status === 'verified'
            const isRejected = doc.status === 'rejected'
            const isWorking = processingId === doc.booking_id

            return (
              <div key={`${doc.customer_id}_${doc.booking_id}`} className="admin-doc-card">
                {/* Card Header */}
                <div className="admin-doc-card-header">
                  <div>
                    <h4 className="doc-cust-name">{doc.customer_name}</h4>
                    <div className="doc-meta-sub">
                      <span>{doc.email}</span> &bull; <span>{doc.phone}</span>
                    </div>
                  </div>
                  <div>
                    <span
                      style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background: isAccepted ? '#dcfce7' : isRejected ? '#fee2e2' : '#fef3c7',
                        color: isAccepted ? '#166534' : isRejected ? '#991b1b' : '#92400e'
                      }}
                    >
                      {doc.status}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="admin-doc-card-body">
                  <div className="doc-info-row">
                    <span>Booking Ref: <strong>{doc.booking_reference}</strong></span>
                    <span>DL No: <strong>{doc.driving_license_number || 'N/A'}</strong></span>
                  </div>

                  <div className="doc-info-row">
                    <span>Submitted: {doc.submitted_at ? new Date(doc.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
                    <span>Trip Status: <strong style={{ textTransform: 'capitalize' }}>{doc.booking_status}</strong></span>
                  </div>

                  {/* Rejection Alert */}
                  {isRejected && doc.rejection_reason && (
                    <div className="doc-rejection-alert">
                      <strong>Rejection Note:</strong> {doc.rejection_reason}
                    </div>
                  )}

                  {/* Images Row */}
                  <div className="doc-images-row">
                    {/* Front */}
                    <div className="doc-img-col">
                      <span className="doc-side-title">Front Side</span>
                      <div
                        className="doc-thumb-box"
                        onClick={() => doc.front_url && setLightboxImage({ src: doc.front_url, title: `${doc.customer_name} - DL Front` })}
                      >
                        {doc.front_url ? (
                          <>
                            <img src={doc.front_url} alt="DL Front" className="doc-thumb-img" />
                            <span className="doc-zoom-hint">Click to Zoom</span>
                          </>
                        ) : (
                          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.75rem' }}>
                            Missing Front
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Back */}
                    <div className="doc-img-col">
                      <span className="doc-side-title">Back Side</span>
                      <div
                        className="doc-thumb-box"
                        onClick={() => doc.back_url && setLightboxImage({ src: doc.back_url, title: `${doc.customer_name} - DL Back` })}
                      >
                        {doc.back_url ? (
                          <>
                            <img src={doc.back_url} alt="DL Back" className="doc-thumb-img" />
                            <span className="doc-zoom-hint">Click to Zoom</span>
                          </>
                        ) : (
                          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.75rem' }}>
                            Missing Back
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="admin-doc-card-footer">
                  <button
                    type="button"
                    disabled={isWorking || isRejected}
                    onClick={() => handleOpenReject(doc)}
                    className="btn-doc-reject"
                    title="Reject Driving Licence photos"
                  >
                    <X size={15} />
                    <span>Reject</span>
                  </button>

                  <button
                    type="button"
                    disabled={isWorking || isAccepted}
                    onClick={() => handleAccept(doc)}
                    className="btn-doc-accept"
                    title="Accept and verify Driving Licence"
                  >
                    <CheckCircle size={15} />
                    <span>Accept Licence</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Image Lightbox Modal */}
      {lightboxImage && (
        <div className="doc-lightbox-backdrop" onClick={() => setLightboxImage(null)}>
          <div className="doc-lightbox-card" onClick={(e) => e.stopPropagation()}>
            <div className="doc-lightbox-header">
              <span style={{ fontWeight: 600 }}>{lightboxImage.title}</span>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            <div className="doc-lightbox-body">
              <img src={lightboxImage.src} alt={lightboxImage.title} className="doc-lightbox-img" />
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectingDoc && (
        <div className="doc-lightbox-backdrop" onClick={() => setRejectingDoc(null)}>
          <div className="doc-lightbox-card" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="doc-lightbox-header" style={{ background: '#b91c1c' }}>
              <span style={{ fontWeight: 700 }}>Reject Driving Licence</span>
              <button
                type="button"
                onClick={() => setRejectingDoc(null)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '1.25rem' }}>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#334155' }}>
                Please specify a reason so the customer can upload corrected licence photos:
              </p>
              <textarea
                rows={3}
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
                placeholder="e.g. Document image is blurry, expired, or name does not match..."
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.875rem',
                  fontFamily: 'inherit'
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setRejectingDoc(null)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  className="btn btn-danger-action"
                  disabled={processingId === rejectingDoc.booking_id}
                >
                  {processingId === rejectingDoc.booking_id ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
