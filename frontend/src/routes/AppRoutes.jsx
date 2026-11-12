import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext.jsx'
import { AdminAuthProvider } from '../context/AdminAuthContext.jsx'

// Customer Shell & Core Customer Pages (eagerly loaded for instant home/browse speed)
import CustomerLayout from '../layouts/CustomerLayout.jsx'
import HomePage from '../pages/customer/HomePage.jsx'
import VehiclesPage from '../pages/customer/VehiclesPage.jsx'
import VehicleDetailPage from '../pages/customer/VehicleDetailPage.jsx'
import BookingPage from '../pages/customer/BookingPage.jsx'

// Lazy-loaded secondary & administrative pages for optimized bundle splitting & faster first-contentful paint
const PaymentPage = lazy(() => import('../pages/customer/PaymentPage.jsx'))
const MyBookingsPage = lazy(() => import('../pages/customer/MyBookingsPage.jsx'))
const LoginPage = lazy(() => import('../pages/auth/LoginPage.jsx'))
const InfoPage = lazy(() => import('../pages/customer/InfoPage.jsx'))

// Staff & Admin Shell & Pages (Phase 7 - lazy loaded)
const AdminLayout = lazy(() => import('../layouts/AdminLayout.jsx'))
const AdminDashboardPage = lazy(() => import('../pages/admin/AdminDashboardPage.jsx'))
const AdminVehiclesPage = lazy(() => import('../pages/admin/AdminVehiclesPage.jsx'))
const AdminBookingsPage = lazy(() => import('../pages/admin/AdminBookingsPage.jsx'))
const AdminCustomersPage = lazy(() => import('../pages/admin/AdminCustomersPage.jsx'))
const AdminPaymentsPage = lazy(() => import('../pages/admin/AdminPaymentsPage.jsx'))
const AdminStaffPage = lazy(() => import('../pages/admin/AdminStaffPage.jsx'))

const RouteSuspenseFallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', color: '#64748b' }}>
    <span>Loading...</span>
  </div>
)

/**
 * Root Application Router
 * Configures both Customer and Staff/Admin routes with separate authentication providers.
 */
export function AppRoutes() {
  return (
    <AuthProvider>
      <AdminAuthProvider>
        <BrowserRouter>
          <Suspense fallback={<RouteSuspenseFallback />}>
            <Routes>
              {/* ----------------- CUSTOMER APPLICATION ROUTES ----------------- */}
              <Route element={<CustomerLayout />}>
                {/* Main Home Page */}
                <Route path="/" element={<HomePage />} />

                {/* Vehicle Collection & Search Results */}
                <Route path="/vehicles" element={<VehiclesPage />} />

                {/* Individual Vehicle Details */}
                <Route path="/vehicles/:id" element={<VehicleDetailPage />} />

                {/* Phase 4: Customer Booking Process */}
                <Route path="/booking" element={<BookingPage />} />

                {/* Phase 5: Payment Integration */}
                <Route path="/payment/:bookingId" element={<PaymentPage />} />

                {/* Phase 6: Customer Bookings Management */}
                <Route path="/my-bookings" element={<MyBookingsPage />} />

                {/* Customer Authentication */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/auth" element={<LoginPage />} />

                {/* Information & Policies */}
                <Route path="/help" element={<InfoPage />} />
                <Route path="/terms" element={<InfoPage />} />
                <Route path="/privacy" element={<InfoPage />} />
              </Route>

              {/* ----------------- PHASE 7: STAFF & ADMIN ROUTES ----------------- */}
              {/* Single Common Login (with staff/customer switch) */}
              <Route path="/admin/login" element={<LoginPage />} />

              {/* Protected Staff/Admin Shell */}
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminDashboardPage />} />
                <Route path="vehicles" element={<AdminVehiclesPage />} />
                <Route path="bookings" element={<AdminBookingsPage />} />
                <Route path="customers" element={<AdminCustomersPage />} />
                <Route path="payments" element={<AdminPaymentsPage />} />
                <Route path="staff" element={<AdminStaffPage />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<HomePage />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AdminAuthProvider>
    </AuthProvider>
  )
}

export default AppRoutes
