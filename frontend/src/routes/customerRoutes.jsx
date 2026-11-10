/**
 * Customer Module Route Definitions
 */

export const customerRoutes = [
  {
    path: '/',
    name: 'Home'
  },
  {
    path: '/vehicles',
    name: 'Explore Vehicles'
  },
  {
    path: '/vehicles/:id',
    name: 'Vehicle Details'
  },
  {
    path: '/booking',
    name: 'Book Vehicle'
  },
  {
    path: '/payment/:bookingId',
    name: 'Payment Checkout'
  },
  {
    path: '/my-bookings',
    name: 'My Bookings'
  },
  {
    path: '/login',
    name: 'Login / Register'
  },
  {
    path: '/help',
    name: 'Help & FAQs'
  },
  {
    path: '/terms',
    name: 'Terms and Conditions'
  },
  {
    path: '/privacy',
    name: 'Privacy Policy'
  }
]

export default customerRoutes
