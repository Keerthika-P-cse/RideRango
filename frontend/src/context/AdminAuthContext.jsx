import { useState, useEffect } from 'react'
import adminApi from '../services/adminApi.js'
import { AdminAuthContext } from './adminAuthContextDef.js'

export function AdminAuthProvider({ children }) {
  const [adminUser, setAdminUser] = useState(() => {
    try {
      const stored = localStorage.getItem('riderango_admin_user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('riderango_admin_token') || null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const verifyStaff = async () => {
      const storedToken = localStorage.getItem('riderango_admin_token')
      if (!storedToken) {
        if (isMounted) setLoading(false)
        return
      }

      try {
        const res = await adminApi.getMe()
        if (isMounted && res.success && res.data?.user) {
          setAdminUser(res.data.user)
          localStorage.setItem('riderango_admin_user', JSON.stringify(res.data.user))
        }
      } catch (err) {
        console.warn('Admin token verification failed:', err.message)
        if (isMounted) {
          localStorage.removeItem('riderango_admin_token')
          localStorage.removeItem('riderango_admin_user')
          setToken(null)
          setAdminUser(null)
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    verifyStaff()

    return () => {
      isMounted = false
    }
  }, [])

  const login = async (email, password) => {
    const res = await adminApi.login(email, password)
    if (res && res.success && res.data?.token) {
      const { token: receivedToken, user: receivedUser } = res.data
      localStorage.setItem('riderango_admin_token', receivedToken)
      localStorage.setItem('riderango_admin_user', JSON.stringify(receivedUser))
      setToken(receivedToken)
      setAdminUser(receivedUser)
      return { success: true, user: receivedUser }
    }
    throw new Error(res?.message || 'Login failed')
  }

  const logout = () => {
    localStorage.removeItem('riderango_admin_token')
    localStorage.removeItem('riderango_admin_user')
    setToken(null)
    setAdminUser(null)
  }

  const value = {
    adminUser,
    token,
    loading,
    isAuthenticated: Boolean(token && adminUser),
    isAdmin: adminUser?.role === 'admin',
    login,
    logout
  }

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export default AdminAuthProvider
