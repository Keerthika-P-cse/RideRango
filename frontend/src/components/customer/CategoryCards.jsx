import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { categoriesData } from '../../data/vehiclesData.js'
import './CategoryCards.css'

export default function CategoryCards() {
  return (
    <section className="categories-section-wrapper">
      <div className="categories-container">
        {/* Section Header */}
        <div className="section-header">
          <div className="section-title-group">
            <span className="section-eyebrow">Browse by Type</span>
            <h2 className="section-heading">Vehicle Categories</h2>
          </div>
          <p className="section-subtext">
            Pick the right vehicle category for your daily commute, road trip or commercial cargo.
          </p>
        </div>

        {/* 4 Cards Grid */}
        <div className="categories-grid">
          {categoriesData.map((category) => (
            <Link
              key={category.id}
              to={`/vehicles?category=${category.slug}`}
              className="category-card"
            >
              {/* Image Frame */}
              <div className="category-image-box">
                <img
                  src={category.image}
                  alt={`RideRango ${category.name}`}
                  className="category-img"
                  loading="lazy"
                />
              </div>

              {/* Card Body */}
              <div className="category-body">
                <div className="category-title-row">
                  <h3 className="category-name">{category.name}</h3>
                  <span className="category-price-tag">
                    From ₹{category.startingPrice} <span className="per-day">/ day</span>
                  </span>
                </div>

                <p className="category-desc">{category.tagline}</p>

                <div className="category-footer">
                  <span className="category-cta-text">Explore {category.name}</span>
                  <span className="category-cta-icon">
                    <ArrowRight size={16} />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
