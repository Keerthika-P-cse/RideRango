import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, FileText, HelpCircle, Shield } from 'lucide-react'
import './PlaceholderPage.css'

export default function InfoPage() {
  const location = useLocation()
  const path = location.pathname

  let title = 'Help & FAQs'
  let icon = <HelpCircle size={32} />
  let description =
    'Find quick answers regarding vehicle booking, refundable security deposits, pickup locations, and fuel policy.'

  if (path === '/terms') {
    title = 'Terms and Conditions'
    icon = <FileText size={32} />
    description =
      'Standard terms for RideRango vehicle rentals: age eligibility (18+), valid driving license requirements, speed governance, and rental return guidelines.'
  } else if (path === '/privacy') {
    title = 'Privacy Policy'
    icon = <Shield size={32} />
    description =
      'How RideRango handles customer personal information, government ID proofs, and encrypted payment security.'
  }

  return (
    <div className="placeholder-page-wrapper">
      <div className="placeholder-container">
        <div className="placeholder-card">
          <div className="placeholder-icon-box">{icon}</div>

          <span className="placeholder-tag">Information Page</span>
          <h1 className="placeholder-title">{title}</h1>

          <p className="placeholder-desc">{description}</p>

          <div className="placeholder-actions">
            <Link to="/" className="btn btn-primary">
              <ArrowLeft size={16} />
              <span>Back to Home</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
