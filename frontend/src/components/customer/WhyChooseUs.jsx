import { CalendarCheck, CheckCircle2, Headphones, Tag } from 'lucide-react'
import './WhyChooseUs.css'

export default function WhyChooseUs() {
  const benefits = [
    {
      id: 1,
      icon: <CalendarCheck size={24} />,
      title: 'Easy Booking',
      description: 'Book in under two minutes online. Pick your vehicle, dates, and collect it from our hub.'
    },
    {
      id: 2,
      icon: <Tag size={24} />,
      title: 'Clear Pricing',
      description: 'Transparent daily rates in Rupees. No unexpected charges, hidden fees or fine-print surprises.'
    },
    {
      id: 3,
      icon: <CheckCircle2 size={24} />,
      title: 'Well-Maintained Vehicles',
      description: 'Quality cars, bikes and scooties kept in good running order for your daily commute and road trips.'
    },
    {
      id: 4,
      icon: <Headphones size={24} />,
      title: 'Quick Support',
      description: 'Friendly customer assistance available by phone, email or at our pickup hubs during operating hours.'
    }
  ]

  return (
    <section className="why-choose-wrapper">
      <div className="why-choose-container">
        {/* Section Header */}
        <div className="section-header center-header">
          <div className="section-title-group center-title">
            <span className="section-eyebrow">The RideRango Promise</span>
            <h2 className="section-heading">Why Choose RideRango?</h2>
          </div>
          <p className="section-subtext center-subtext">
            Simple, honest vehicle rentals built for real everyday travel.
          </p>
        </div>

        {/* Benefits Grid */}
        <div className="benefits-grid">
          {benefits.map((item) => (
            <div key={item.id} className="benefit-card">
              <div className="benefit-icon-box">
                {item.icon}
              </div>
              <h3 className="benefit-title">{item.title}</h3>
              <p className="benefit-desc">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
