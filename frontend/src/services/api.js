/**
 * RideRango Centralised API Service
 * Communicates with the Express backend using configured environment variables.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'

class ApiError extends Error {
  constructor(message, status = 500, details = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

const getStoredToken = () => {
  try {
    return localStorage.getItem('riderango_token')
  } catch {
    return null
  }
}

async function request(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  const primaryUrl = `${API_BASE_URL}${cleanEndpoint}`

  const token = getStoredToken()
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
  } catch (networkErr) {
    // Graceful network fallback: try 127.0.0.1 and local proxy
    try {
      if (primaryUrl.includes('localhost:5000')) {
        const fallback127 = primaryUrl.replace('localhost:5000', '127.0.0.1:5000')
        response = await fetch(fallback127, config)
      } else {
        const proxyUrl = `/api/v1${cleanEndpoint}`
        response = await fetch(proxyUrl, config)
      }
    } catch {
      throw new ApiError(
        'Unable to connect to the RideRango server. Please check your internet connection or try again shortly.',
        0,
        networkErr
      )
    }
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const errorMessage = data?.message || `HTTP error ${response.status}: ${response.statusText}`
    throw new ApiError(errorMessage, response.status, data?.errors || null)
  }

  return data
}

export const api = {
  get: (endpoint, headers) => request(endpoint, { method: 'GET', headers }),
  post: (endpoint, body, headers) => request(endpoint, { method: 'POST', body, headers }),
  put: (endpoint, body, headers) => request(endpoint, { method: 'PUT', body, headers }),
  delete: (endpoint, headers) => request(endpoint, { method: 'DELETE', headers }),

  // System & Health connectivity check
  checkHealth: async () => {
    return request('/health')
  },

  // Vehicle endpoints
  getVehicles: async (params = {}) => {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== 'all')
    )
    const query = new URLSearchParams(cleanParams).toString()
    return request(`/vehicles${query ? `?${query}` : ''}`)
  },

  getVehicleById: async (id) => {
    return request(`/vehicles/${id}`)
  },

  getCategories: async () => {
    return request('/categories')
  },

  getBrands: async (category) => {
    const query = category && category !== 'all' ? `?category=${category}` : ''
    return request(`/brands${query}`)
  },

  // Authentication endpoints
  login: async (email, password) => {
    return request('/auth/login', {
      method: 'POST',
      body: { email, password }
    })
  },

  register: async (customerData) => {
    return request('/auth/register', {
      method: 'POST',
      body: customerData
    })
  },

  getMe: async () => {
    return request('/auth/me')
  },

  // Availability & Booking endpoints
  checkAvailability: async (vehicleId, startDate, endDate) => {
    const query = new URLSearchParams({ startDate, endDate }).toString()
    return request(`/vehicles/${vehicleId}/availability?${query}`)
  },

  createBooking: async (bookingData) => {
    return request('/bookings', {
      method: 'POST',
      body: bookingData
    })
  },

  getMyBookings: async () => {
    return request('/bookings/my-bookings')
  },

  getBookingById: async (id) => {
    return request(`/bookings/${id}`)
  },

  cancelBooking: async (id, reason) => {
    return request(`/bookings/${id}/cancel`, {
      method: 'POST',
      body: { reason }
    })
  },

  // Payment endpoints (Razorpay)
  createPaymentOrder: async (bookingId) => {
    return request('/payments/create-order', {
      method: 'POST',
      body: { booking_id: bookingId }
    })
  },

  verifyPayment: async (verificationPayload) => {
    return request('/payments/verify', {
      method: 'POST',
      body: verificationPayload
    })
  },

  recordPaymentFailure: async (failurePayload) => {
    return request('/payments/failure', {
      method: 'POST',
      body: failurePayload
    })
  },

  getBaseUrl: () => API_BASE_URL
}

export default api
