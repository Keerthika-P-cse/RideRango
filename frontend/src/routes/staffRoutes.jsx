/**
 * Staff & Fleet Module Route Configuration
 * Defines path patterns and placeholders for staff operations.
 * (Actual screen components will be developed in subsequent milestones)
 */

export const staffRoutes = [
  {
    path: '/staff/dashboard',
    name: 'Staff Operations Dashboard'
  },
  {
    path: '/staff/fleet',
    name: 'Fleet Management'
  },
  {
    path: '/staff/verifications',
    name: 'Customer Document Verifications'
  },
  {
    path: '/staff/handovers',
    name: 'Rental Handovers & Dispatch'
  },
  {
    path: '/staff/returns',
    name: 'Rental Returns & Inspections'
  }
]

export default staffRoutes
