import { useState } from 'react'
import { resolveVehicleImage } from '../../utils/vehicleImageHelper.js'
import './VehicleImage.css'

/**
 * Common VehicleImage component
 * Features:
 * 1. Synchronous model-exact image resolution so images never flash or swap across models.
 * 2. Renders a clean non-misleading UI placeholder when no verified model image is available.
 * 3. Zero layout shifts via consistent container sizing.
 */
export default function VehicleImage({
  vehicle,
  src,
  alt = 'Vehicle',
  className = '',
  loading = 'lazy',
  ...rest
}) {
  const initialResolved = resolveVehicleImage(vehicle, src)
  const [erroredSrc, setErroredSrc] = useState('')

  const handleError = () => {
    setErroredSrc(initialResolved)
  }

  if (!initialResolved || erroredSrc === initialResolved) {
    const label = vehicle
      ? `${vehicle.make || vehicle.brand || ''} ${vehicle.model || vehicle.name || ''}`.trim()
      : alt
    return (
      <div
        className={`vehicle-image-fallback ${className}`}
        role="img"
        aria-label={label || 'Vehicle photo unavailable'}
      >
        <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2.5" />
          <circle cx="8.5" cy="9.5" r="1.5" />
          <path d="M21 15l-5-5L5 20" />
        </svg>
        <span className="vehicle-image-fallback-title">{label || 'Model Photo Pending'}</span>
        <span className="vehicle-image-fallback-sub">Verified model photo unavailable</span>
      </div>
    )
  }

  return (
    <img
      src={initialResolved}
      alt={alt}
      className={`vehicle-image-stable ${className}`}
      loading={loading}
      decoding="async"
      onError={handleError}
      {...rest}
    />
  )
}
