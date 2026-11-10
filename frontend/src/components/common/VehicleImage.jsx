import { useState } from 'react'
import { getCategoryFallbackImage, resolveVehicleImage } from '../../utils/vehicleImageHelper.js'
import './VehicleImage.css'

/**
 * Common VehicleImage component
 * Features:
 * 1. Synchronous single-pass image resolution so images don't switch or flash.
 * 2. Strict category-accurate fallbacks (utility -> utility, bike -> bike, scooter -> scooter, car -> car).
 * 3. Prevents infinite onError loops and flicker by switching to fallback once.
 * 4. Zero layout shifts via CSS aspect-ratio.
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
  const [currentSrc, setCurrentSrc] = useState(initialResolved)
  const [hasErrored, setHasErrored] = useState(false)

  const handleError = () => {
    if (!hasErrored) {
      setHasErrored(true)
      const fallback = getCategoryFallbackImage(vehicle)
      if (fallback !== currentSrc) {
        setCurrentSrc(fallback)
      }
    }
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={`vehicle-image-stable ${className}`}
      loading={loading}
      decoding="async"
      onError={handleError}
      {...rest}
    />
  )
}
