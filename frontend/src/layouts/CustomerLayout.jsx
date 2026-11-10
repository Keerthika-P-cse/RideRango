import { Outlet } from 'react-router-dom'
import Navbar from '../components/common/Navbar.jsx'
import Footer from '../components/common/Footer.jsx'
import './CustomerLayout.css'

export default function CustomerLayout() {
  return (
    <div className="customer-layout-shell">
      <Navbar />
      <main className="customer-main-content">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
