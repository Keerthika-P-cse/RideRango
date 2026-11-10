import { Link } from 'react-router-dom'
import { ArrowRight, Calendar, CheckCircle2, Zap } from 'lucide-react'
import './HeroBanner.css'

export default function HeroBanner() {
  const scrollToSearch = (e) => {
    e.preventDefault()
    const searchSection = document.getElementById('search-vehicles-section')
    if (searchSection) {
      searchSection.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <section className="hero-banner-wrapper">
      <div className="hero-banner-container">
        {/* Left Column: Heading & Call to Actions */}
        <div className="hero-content">
          <div className="hero-eyebrow">
            <span className="eyebrow-dot"></span>
            <span>Simple &bull; Fast &bull; Reliable</span>
          </div>

          <h1 className="hero-title">
            Rent the Right Vehicle <br />
            for <span className="title-highlight">Every Trip.</span>
          </h1>

          <p className="hero-subtitle">
            Choose from clean cars, bikes, scooties and utility trucks in Bengaluru.
            Enjoy clear daily pricing, quick pickup at our hubs, and friendly customer support.
          </p>

          <div className="hero-buttons">
            <Link to="/vehicles" className="btn btn-primary hero-btn-primary">
              <span>Explore Vehicles</span>
              <ArrowRight size={18} />
            </Link>

            <a
              href="#search-vehicles-section"
              onClick={scrollToSearch}
              className="btn btn-secondary hero-btn-secondary"
            >
              <Calendar size={18} />
              <span>Book Now</span>
            </a>
          </div>

          {/* Key Advantages Checklist */}
          <div className="hero-features-list">
            <div className="feature-item">
              <CheckCircle2 size={16} className="feature-icon" />
              <span>Clear Pricing</span>
            </div>
            <div className="feature-item">
              <CheckCircle2 size={16} className="feature-icon" />
              <span>Clean Vehicles</span>
            </div>
            <div className="feature-item">
              <Zap size={16} className="feature-icon" />
              <span>Quick Pickup</span>
            </div>
          </div>
        </div>

        {/* Right Column: High Quality Automotive Visual */}
        <div className="hero-visual-card">
          <div className="hero-image-frame">
            <img
              src="/images/hero-car.jpg"
              alt="RideRango Premium Rental Car"
              className="hero-car-image"
              loading="eager"
            />
            {/* Velocity X Floating Highlight Badge */}
            <div className="hero-floating-badge">
              <div className="badge-text-group">
                <span className="badge-small-label">Starting From</span>
                <span className="badge-price-val">₹449<span className="per-day"> / day</span></span>
              </div>
              <span className="badge-category-tag">Scooties &bull; Bikes &bull; Cars</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
