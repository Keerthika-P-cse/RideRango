import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../context/AuthContext.jsx'
import { AdminAuthProvider } from '../context/AdminAuthContext.jsx'

// Customer Shell & Pages
import CustomerLayout from '../layouts/CustomerLayout.jsx'
import HomePage from '../pages/customer/HomePage.jsx'
import VehiclesPage from '../pages/customer/VehiclesPage.jsx'
import VehicleDetailPage from '../pages/customer/VehicleDetailPage.jsx'
import BookingPage from '../pages/customer/BookingPage.jsx'
import PaymentPage from '../pages/customer/PaymentPage.jsx'
import MyBookingsPage from '../pages/customer/MyBookingsPage.jsx'
import LoginPage from '../pages/auth/LoginPage.jsx'
import InfoPage from '../pages/customer/InfoPage.jsx'

// Staff & Admin Shell & Pages (Phase 7)
import AdminLayout from '../layouts/AdminLayout.jsx'
import AdminDashboardPage from '../pages/admin/AdminDashboardPage.jsx'
import AdminVehiclesPage from '../pages/admin/AdminVehiclesPage.jsx'
import AdminBookingsPage from '../pages/admin/AdminBookingsPage.jsx'
import AdminCustomersPage from '../pages/admin/AdminCustomersPage.jsx'
import AdminPaymentsPage from '../pages/admin/AdminPaymentsPage.jsx'
import AdminStaffPage from '../pages/admin/AdminStaffPage.jsx'

/**
 * Root Application Router
 * Configures both Customer and Staff/Admin routes with separate authentication providers.
 */
export function AppRoutes() {
  return (
    <AuthProvider>
      <AdminAuthProvider>
        <BrowserRouter>
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
        </BrowserRouter>
      </AdminAuthProvider>
    </AuthProvider>
  )
}

export default AppRoutes
