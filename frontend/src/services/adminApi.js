/**
 * RideRango Staff / Admin API Service
 * Securely communicates with admin backend endpoints using 'riderango_admin_token'.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'

const getAdminToken = () => {
  try {
    return localStorage.getItem('riderango_admin_token')
  } catch {
    return null
  }
}

async function adminRequest(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  const primaryUrl = `${API_BASE_URL}${cleanEndpoint}`

  const token = getAdminToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  }

  const config = {
    ...options,
    headers
  }

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body)
  }

  let response
  try {
    response = await fetch(primaryUrl, config)
  } catch {
    try {
      if (primaryUrl.includes('localhost:5000')) {
        const fallback127 = primaryUrl.replace('localhost:5000', '127.0.0.1:5000')
        response = await fetch(fallback127, config)
      } else {
        const proxyUrl = `/api/v1${cleanEndpoint}`
        response = await fetch(proxyUrl, config)
      }
    } catch {
      throw new Error('Unable to connect to the RideRango server. Please check your internet connection or try again shortly.')
    }
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const errorMsg = data?.message || `Request failed with status ${response.status}`
    const error = new Error(errorMsg)
    error.status = response.status
    error.data = data
    throw error
  }

  return data
}

export const adminApi = {
  // Auth
  login: (email, password) =>
    adminRequest('/admin/auth/login', { method: 'POST', body: { email, password } }),
  registerStaff: (payload) =>
    adminRequest('/admin/auth/register', { method: 'POST', body: payload }),
  getMe: () => adminRequest('/admin/auth/me'),

  // Stats
  getDashboardStats: () => adminRequest('/admin/dashboard/stats'),

  // Categories & Vehicles
  getCategories: () => adminRequest('/admin/categories'),
  getVehicles: () => adminRequest('/admin/vehicles'),
  createVehicle: (payload) =>
    adminRequest('/admin/vehicles', { method: 'POST', body: payload }),
  updateVehicle: (id, payload) =>
    adminRequest(`/admin/vehicles/${id}`, { method: 'PUT', body: payload }),

  // Bookings
  getBookings: (params = {}) => {
    const query = new URLSearchParams()
    if (params.status) query.append('status', params.status)
    if (params.search) query.append('search', params.search)
    const qs = query.toString() ? `?${query.toString()}` : ''
    return adminRequest(`/admin/bookings${qs}`)
  },
  updateBookingStatus: (id, status) =>
    adminRequest(`/admin/bookings/${id}/status`, { method: 'PUT', body: { status } }),

  // Customers
  getCustomers: () => adminRequest('/admin/customers'),
  getCustomerHistory: (id) => adminRequest(`/admin/customers/${id}/bookings`),

  // Payments
  getPayments: () => adminRequest('/admin/payments'),

  // Staff (Admin Only)
  getStaff: () => adminRequest('/admin/staff'),
  createStaff: (payload) =>
    adminRequest('/admin/staff', { method: 'POST', body: payload }),
  toggleStaffStatus: (id, is_active) =>
    adminRequest(`/admin/staff/${id}/status`, { method: 'PATCH', body: { is_active } }),
  updateStaffApproval: (id, approval_status) =>
    adminRequest(`/admin/staff/${id}/approval`, { method: 'PATCH', body: { approval_status } })
}

export default adminApi
