import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronDown,
  FileText,
  HelpCircle,
  Shield
} from 'lucide-react'
import './PlaceholderPage.css'
import './InfoPage.css'

export default function InfoPage() {
  const location = useLocation()
  const path = location.pathname

  const [openFaq, setOpenFaq] = useState({ 0: true })

  const toggleFaq = (index) => {
    setOpenFaq((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  // 1. HELP & FAQS
  if (path === '/help') {
    const faqs = [
      {
        q: 'How do I register an account and log in?',
        a: 'Click "Login / Register" in the top navigation bar. Enter your email address and password to create an account, or log in with your existing credentials. You can update your driving license number and contact phone number either in your account or directly when confirming a booking.'
      },
      {
        q: 'How do I find and book a vehicle?',
        a: 'Browse the catalogue from the "Explore Vehicles" page or filter by category (Cars, Bikes, Scooties, Utility Vehicles), brand, transmission, and fuel type. Models with live database inventory display an active "Book Now" button. Select your pickup and return dates and times, review the transparent price breakdown, and proceed to booking.'
      },
      {
        q: 'How does payment work?',
        a: 'RideRango supports secure online payments powered by Razorpay. For our academic demonstration and evaluation, the application also includes a clearly labelled DEMO PAYMENT mode (simulated transactions with no real money transferred). You can test successful payment confirmation or simulate a declined payment.'
      },
      {
        q: 'How do I check vehicle availability and booked dates?',
        a: 'Every vehicle detail page and the booking page query the live database to show upcoming booked date ranges in real time. If a vehicle is already reserved for a given window, those dates are clearly listed, and the system prevents conflicting bookings.'
      },
      {
        q: 'How do I cancel a booking?',
        a: 'Go to "My Bookings" from the navigation menu. Locate any upcoming pending or confirmed booking, click the "Cancel" button, review the cancellation summary, and confirm. Your booking status will update to cancelled immediately and the vehicle is restored to available.'
      },
      {
        q: 'How do refunds work?',
        a: 'RideRango implements a 100% full refund policy for eligible paid bookings cancelled before pickup. No cancellation deductions or processing fees are charged. In demo mode, a 100% simulated refund record is generated immediately and displayed in both customer and admin dashboards.'
      }
    ]

    return (
      <div className="info-page-wrapper">
        <div className="info-page-container">
          <div className="info-header">
            <div className="info-icon-badge"><HelpCircle size={28} /></div>
            <span className="info-tag">Customer Support</span>
            <h1 className="info-title">Help &amp; Frequently Asked Questions</h1>
            <p className="info-subtitle">
              Quick answers about vehicle booking, live availability, payment options, and the 100% refund workflow.
            </p>
          </div>

          <div className="faq-list">
            {faqs.map((faq, idx) => (
              <div key={idx} className={`faq-card ${openFaq[idx] ? 'open' : ''}`}>
                <button
                  type="button"
                  className="faq-question-btn"
                  onClick={() => toggleFaq(idx)}
                  aria-expanded={Boolean(openFaq[idx])}
                >
                  <span className="faq-question-text">{faq.q}</span>
                  <ChevronDown size={18} className="faq-chevron" />
                </button>
                {openFaq[idx] && (
                  <div className="faq-answer-body">
                    <p>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="info-footer-actions">
            <Link to="/" className="btn btn-secondary">
              <ArrowLeft size={16} />
              <span>Back to Home</span>
            </Link>
            <Link to="/vehicles" className="btn btn-primary">
              <span>Explore Vehicles</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // 2. TERMS & CONDITIONS
  if (path === '/terms') {
    return (
      <div className="info-page-wrapper">
        <div className="info-page-container">
          <div className="info-header">
            <div className="info-icon-badge"><FileText size={28} /></div>
            <span className="info-tag">Legal &amp; Rental Terms</span>
            <h1 className="info-title">Terms &amp; Conditions</h1>
            <p className="info-subtitle">
              Standard rules and conditions governing vehicle bookings and usage on RideRango.
            </p>
          </div>

          <div className="policy-content">
            <section className="policy-section">
              <h2>1. Booking Rules and Vehicle Usage</h2>
              <p>
                To rent a vehicle through RideRango, customers must be at least 18 years of age and hold a valid, government-issued Indian Driving License appropriate for the vehicle category (Light Motor Vehicle for cars/utility, two-wheeler license for bikes/scooties). Vehicles must only be driven by the registered customer and must not be used for illegal activities, subleasing, or speed racing.
              </p>
            </section>

            <section className="policy-section">
              <h2>2. Payment &amp; Booking Confirmation</h2>
              <p>
                A booking remains in a <code>pending</code> status until payment is verified. Upon successful payment verification (via Razorpay or authorized demo simulation), the booking is immediately confirmed, the vehicle is reserved, and a unique booking reference (e.g. <code>RR-BK-...</code>) is issued. Transparent pricing includes the daily rental rate and a refundable security deposit.
              </p>
            </section>

            <section className="policy-section">
              <h2>3. Cancellation and 100% Refund Policy</h2>
              <p>
                Customers may cancel any eligible upcoming booking prior to scheduled pickup directly through the "My Bookings" portal. RideRango enforces a 100% full refund policy for paid cancellations—no cancellation fee or administrative deductions are withheld. The vehicle availability is safely restored to the fleet upon cancellation.
              </p>
            </section>

            <section className="policy-section">
              <h2>4. Customer Responsibilities &amp; Handover</h2>
              <p>
                Customers are responsible for returning the vehicle at the agreed return date, time, and designated hub in Bengaluru. The vehicle must be returned in the same operational condition as received. The refundable security deposit is released following routine inspection upon safe return.
              </p>
            </section>
          </div>

          <div className="info-footer-actions">
            <Link to="/" className="btn btn-secondary">
              <ArrowLeft size={16} />
              <span>Back to Home</span>
            </Link>
            <Link to="/help" className="btn btn-secondary">
              <span>View FAQs</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // 3. PRIVACY POLICY
  return (
    <div className="info-page-wrapper">
      <div className="info-page-container">
        <div className="info-header">
          <div className="info-icon-badge"><Shield size={28} /></div>
          <span className="info-tag">Data Protection</span>
          <h1 className="info-title">Privacy Policy</h1>
          <p className="info-subtitle">
            How RideRango handles customer account details, driving licenses, and booking privacy.
          </p>
        </div>

        <div className="policy-content">
          <section className="policy-section">
            <h2>1. Information We Collect</h2>
            <p>
              When you use RideRango, we collect:
            </p>
            <ul>
              <li><strong>Account Information:</strong> First name, last name, and email address.</li>
              <li><strong>Contact &amp; Identity:</strong> Mobile phone number and driving license number required for vehicle handover.</li>
              <li><strong>Booking Details:</strong> Selected vehicles, pickup/return dates, times, and designated rental hubs.</li>
            </ul>
          </section>

          <section className="policy-section">
            <h2>2. Why Information Is Needed</h2>
            <p>
              Your personal information is strictly used to authenticate your session, generate legally compliant vehicle rental agreements, schedule vehicle pickup, and update you on booking confirmations and cancellations.
            </p>
          </section>

          <section className="policy-section">
            <h2>3. Payment Information Handling</h2>
            <p>
              RideRango does not collect, store, or process raw credit/debit card numbers or bank credentials on our servers. When using online payments, payment transactions are handled directly through Razorpay's checkout interface. When operating in DEMO PAYMENT mode, all simulated outcomes are recorded solely for demonstration with zero financial transaction or bank data involved.
            </p>
          </section>

          <section className="policy-section">
            <h2>4. Data Protection &amp; Privacy</h2>
            <p>
              We protect account passwords using salted cryptographic hashing (bcrypt) and authenticate API communication with JSON Web Tokens (JWT). We do not sell or share customer personal information with third-party advertisers. Public availability endpoints only share anonymized booking date ranges to prevent scheduling conflicts, without exposing customer identities.
            </p>
          </section>
        </div>

        <div className="info-footer-actions">
          <Link to="/" className="btn btn-secondary">
            <ArrowLeft size={16} />
            <span>Back to Home</span>
          </Link>
          <Link to="/terms" className="btn btn-secondary">
            <span>Terms of Service</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
