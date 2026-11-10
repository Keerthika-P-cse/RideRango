import { useState, useEffect } from 'react'
import api from '../services/api.js'
import { AuthContext } from './authContextDef.js'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('riderango_user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('riderango_token') || null
    } catch {
      return null
    }
  })
  const [isLoading, setIsLoading] = useState(true)

  // Verify stored session on initial mount
  useEffect(() => {
    let isMounted = true

    async function checkAuth() {
      const storedToken = localStorage.getItem('riderango_token')
      if (storedToken) {
        try {
          const res = await api.getMe()
          if (isMounted && res && res.success && res.data) {
            setUser(res.data)
            localStorage.setItem('riderango_user', JSON.stringify(res.data))
          }
        } catch {
          // Token invalid or expired
          if (isMounted) {
            setUser(null)
            setToken(null)
            localStorage.removeItem('riderango_token')
            localStorage.removeItem('riderango_user')
          }
        }
      }
      if (isMounted) {
        setIsLoading(false)
      }
    }

    checkAuth()

    return () => {
      isMounted = false
    }
  }, [])

  const login = async (email, password) => {
    const res = await api.login(email, password)
    if (res && res.success && res.data) {
      setToken(res.data.token)
      setUser(res.data.customer)
      localStorage.setItem('riderango_token', res.data.token)
      localStorage.setItem('riderango_user', JSON.stringify(res.data.customer))
      return res.data
    }
    throw new Error(res?.message || 'Login failed')
  }

  const register = async (customerData) => {
    const res = await api.register(customerData)
    if (res && res.success && res.data) {
      setToken(res.data.token)
      setUser(res.data.customer)
      localStorage.setItem('riderango_token', res.data.token)
      localStorage.setItem('riderango_user', JSON.stringify(res.data.customer))
      return res.data
    }
    throw new Error(res?.message || 'Registration failed')
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('riderango_token')
    localStorage.removeItem('riderango_user')
  }

  const refreshUser = async () => {
    try {
      const res = await api.getMe()
      if (res && res.success && res.data) {
        setUser(res.data)
        localStorage.setItem('riderango_user', JSON.stringify(res.data))
      }
    } catch {
      // Ignore
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(user && token),
        isLoading,
        login,
        register,
        logout,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export default AuthProvider
