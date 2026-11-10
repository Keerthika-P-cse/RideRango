import { useState, useEffect } from 'react'
import {
  UserPlus,
  ShieldAlert,
  CheckCircle,
  X,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  UserCheck,
  UserX
} from 'lucide-react'
import adminApi from '../../services/adminApi.js'
import { useAdminAuth } from '../../context/useAdminAuth.js'
import './AdminStaffPage.css'

export default function AdminStaffPage() {
  const { adminUser, isAdmin } = useAdminAuth()

  const [staffList, setStaffList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Add staff modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: '',
    role: 'fleet_staff'
  })
  const [submitting, setSubmitting] = useState(false)
  const [modalError, setModalError] = useState('')

  const loadStaff = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminApi.getStaff()
      if (res && res.success && res.data) {
        setStaffList(res.data)
      }
    } catch (err) {
      setError(err.message || 'Failed to load staff accounts.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      loadStaff()
    }
  }, [isAdmin])

  if (!isAdmin) {
    return (
      <div className="admin-access-denied-box">
        <ShieldAlert size={48} className="denied-icon" />
        <h2>Access Restricted</h2>
        <p>Staff account management requires full Administrator privileges.</p>
      </div>
    )
  }

  const handleToggleStatus = async (staffMember) => {
    if (staffMember.id === adminUser?.id) {
      setError('You cannot deactivate your own administrative account.')
      return
    }

    const nextStatus = staffMember.is_active ? 0 : 1
    try {
      const res = await adminApi.toggleStaffStatus(staffMember.id, nextStatus)
      if (res && res.success) {
        setSuccessMsg(`Account for ${staffMember.first_name} ${staffMember.last_name} has been ${nextStatus ? 'activated' : 'deactivated'}.`)
        await loadStaff()
      }
    } catch (err) {
      setError(err.message || 'Failed to update staff status.')
    }
  }

  const handleApprovalAction = async (staffMember, targetStatus) => {
    try {
      const res = await adminApi.updateStaffApproval(staffMember.id, targetStatus)
      if (res && res.success) {
        setSuccessMsg(`Staff application for ${staffMember.first_name} ${staffMember.last_name} has been ${targetStatus}.`)
        await loadStaff()
      }
    } catch (err) {
      setError(err.message || 'Failed to update staff approval status.')
    }
  }

  const handleFormChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleCreateStaff = async (e) => {
    e.preventDefault()
    setModalError('')
    setSubmitting(true)

    try {
      const res = await adminApi.createStaff(formData)
      if (res && res.success) {
        setSuccessMsg(`Staff account for ${formData.first_name} created successfully.`)
        setShowAddModal(false)
        setFormData({
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
          password: '',
          role: 'fleet_staff'
        })
        await loadStaff()
      }
    } catch (err) {
      setModalError(err.message || 'Failed to create staff account.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-staff-container">
      {/* Header */}
      <div className="staff-header-row">
        <div>
          <h1 className="dash-title">Manage Staff Accounts</h1>
          <p className="dash-sub">Create and manage staff accounts and roles.</p>
        </div>

        <button type="button" onClick={() => setShowAddModal(true)} className="btn-add-staff">
          <UserPlus size={16} />
          <span>Add Staff Member</span>
        </button>
      </div>

      {successMsg && (
        <div className="dash-success-banner">
          <CheckCircle size={16} />
          <span>{successMsg}</span>
          <button type="button" onClick={() => setSuccessMsg('')} className="btn-close-banner">&times;</button>
        </div>
      )}

      {error && (
        <div className="dash-error-banner">
          <AlertCircle size={16} />
          <span>{error}</span>
          <button type="button" onClick={() => setError('')} className="btn-close-banner">&times;</button>
        </div>
      )}

      {/* Table */}
      <div className="dash-section-card">
        <div className="table-responsive">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>Staff Member</th>
                <th>Email Address</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Approval</th>
                <th>Status</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {staffList.length > 0 ? (
                staffList.map((s) => (
                  <tr key={s.id} className={!s.is_active || s.approval_status === 'rejected' ? 'row-deactivated' : ''}>
                    <td>
                      <div className="cust-name-cell">
                        <div className="cust-avatar-circle">
                          {s.first_name?.[0] || 'S'}
                        </div>
                        <div>
                          <strong>{s.first_name} {s.last_name}</strong>
                          {s.id === adminUser?.id && (
                            <span className="self-tag">(Current Session)</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="cell-sub">{s.email}</span>
                    </td>
                    <td>
                      <span className="cell-sub">{s.phone || 'N/A'}</span>
                    </td>
                    <td>
                      <span className={`user-role-tag role-${s.role}`}>
                        {s.role === 'admin' ? 'Administrator' : 'Staff'}
                      </span>
                    </td>
                    <td>
                      <span className={`approval-tag approval-${s.approval_status || 'approved'}`}>
                        {s.approval_status === 'pending'
                          ? 'Pending Review'
                          : (s.approval_status === 'rejected' ? 'Rejected' : 'Approved')}
                      </span>
                    </td>
                    <td>
                      <span className={`status-dot ${s.is_active ? 'dot-active' : 'dot-inactive'}`}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <span className="cell-dates">{new Date(s.created_at).toLocaleDateString('en-IN')}</span>
                    </td>
                    <td>
                      {s.id !== adminUser?.id ? (
                        <div className="staff-action-group">
                          {s.approval_status === 'pending' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleApprovalAction(s, 'approved')}
                                className="btn-staff-action btn-approve"
                                title="Approve staff application"
                              >
                                <UserCheck size={14} />
                                <span>Approve</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleApprovalAction(s, 'rejected')}
                                className="btn-staff-action btn-reject"
                                title="Reject staff application"
                              >
                                <UserX size={14} />
                                <span>Reject</span>
                              </button>
                            </>
                          ) : s.approval_status === 'rejected' ? (
                            <button
                              type="button"
                              onClick={() => handleApprovalAction(s, 'approved')}
                              className="btn-staff-action btn-reapprove"
                              title="Re-approve this staff member"
                            >
                              <UserCheck size={14} />
                              <span>Re-Approve</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(s)}
                              className="btn-toggle-status"
                              title={s.is_active ? 'Deactivate this staff member' : 'Activate this staff member'}
                            >
                              {s.is_active ? (
                                <>
                                  <ToggleRight size={18} className="toggle-icon-active" />
                                  <span>Make Inactive</span>
                                </>
                              ) : (
                                <>
                                  <ToggleLeft size={18} className="toggle-icon-inactive" />
                                  <span>Make Active</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted">Primary Admin</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="empty-table-cell">
                    {loading ? 'Loading staff accounts...' : 'No staff accounts found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE STAFF MODAL */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <div className="modal-card-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Staff Member</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="btn-modal-close">
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div className="modal-error-box">
                <AlertCircle size={15} />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateStaff} className="modal-form-grid">
              <div className="form-row-2">
                <div className="form-field">
                  <label>First Name *</label>
                  <input
                    name="first_name"
                    type="text"
                    required
                    placeholder="e.g. Vikram"
                    value={formData.first_name}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="form-field">
                  <label>Last Name *</label>
                  <input
                    name="last_name"
                    type="text"
                    required
                    placeholder="e.g. Singh"
                    value={formData.last_name}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-field">
                  <label>Staff Email Address *</label>
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="vikram.fleet@riderango.com"
                    value={formData.email}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="form-field">
                  <label>Phone Number</label>
                  <input
                    name="phone"
                    type="tel"
                    placeholder="+919876543210"
                    value={formData.phone}
                    onChange={handleFormChange}
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-field">
                  <label>Initial Password *</label>
                  <input
                    name="password"
                    type="password"
                    required
                    placeholder="Minimum 6 characters"
                    value={formData.password}
                    onChange={handleFormChange}
                  />
                </div>

                <div className="form-field">
                  <label>Role Assignment *</label>
                  <select name="role" value={formData.role} onChange={handleFormChange}>
                    <option value="fleet_staff">Staff (Operations & Bookings)</option>
                    <option value="admin">Administrator (Full Access)</option>
                  </select>
                </div>
              </div>

              <div className="modal-actions-row">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-modal-cancel">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-modal-submit">
                  {submitting ? 'Creating...' : 'Create Staff Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
