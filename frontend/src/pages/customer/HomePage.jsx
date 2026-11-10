import HeroBanner from '../../components/customer/HeroBanner.jsx'
import SearchWidget from '../../components/customer/SearchWidget.jsx'
import CategoryCards from '../../components/customer/CategoryCards.jsx'
import PopularVehicles from '../../components/customer/PopularVehicles.jsx'
import WhyChooseUs from '../../components/customer/WhyChooseUs.jsx'

export default function HomePage() {
  return (
    <div className="home-page-container">
      {/* 1. Main Hero Banner */}
      <HeroBanner />

      {/* 2. Interactive Search Vehicles Widget */}
      <SearchWidget />

      {/* 3. Four Vehicle Categories (Cars, Bikes, Scooties, Utility) */}
      <CategoryCards />

      {/* 4. Real Indian Popular Vehicles Selection */}
      <PopularVehicles />

      {/* 5. Customer Value & Benefits */}
      <WhyChooseUs />
    </div>
  )
}
