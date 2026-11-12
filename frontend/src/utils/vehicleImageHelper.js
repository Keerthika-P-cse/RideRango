import { vehiclesData as catalogVehicles } from '../data/vehiclesData.js'

/**
 * Strictly resolve a verified local image matching the exact vehicle model.
 * Returns '' when no verified image exists so components can render a clean
 * non-misleading fallback instead of showing another vehicle model.
 */
export const resolveExactModelImagePath = (make = '', model = '') => {
  const m = `${make} ${model}`.toLowerCase().replace(/\s+/g, ' ').trim()
  if (!m) return ''

  if (m.includes('nexon') && m.includes('ev')) return '/images/vehicle-nexon-ev.png'
  if (m.includes('creta')) return '/images/vehicle-creta.jpg'
  if (m.includes('swift')) return '/images/vehicle-swift.jpg'
  if (m.includes('baleno')) return '/images/model-baleno.jpg'
  if (m.includes('brezza')) return '/images/model-brezza.png'
  if (m.includes('dzire')) return '/images/model-dzire.jpg'
  if (m.includes('ertiga')) return '/images/model-ertiga.jpg'
  if (m.includes('i20')) return '/images/model-i20.png'
  if (m.includes('venue')) return '/images/model-venue.jpg'
  if (m.includes('verna')) return '/images/model-verna.png'
  if (m.includes('exter')) return '/images/model-exter.png'
  if (m.includes('tiago')) return '/images/model-tiago.jpg'
  if (m.includes('punch')) return '/images/model-punch.png'
  if (m.includes('harrier') && !m.includes('ev')) return '/images/model-harrier.jpg'
  if (m.includes('tigor')) return '/images/model-tigor.jpg'
  if (m.includes('thar')) return '/images/vehicle-thar.jpg'
  if (m.includes('scorpio')) return '/images/model-scorpio-n.jpg'
  if (m.includes('xuv700')) return '/images/model-xuv700.png'
  if (m.includes('xuv 3xo') || m.includes('3xo')) return '/images/model-xuv3xo.jpg'
  if (m.includes('innova') && m.includes('crysta')) return '/images/vehicle-innova.jpg'
  if (m.includes('fortuner')) return '/images/model-fortuner.jpg'
  if (m.includes('glanza')) return '/images/model-glanza.jpg'
  if (m.includes('hyryder')) return '/images/model-hyryder.jpg'
  if (m.includes('rumion')) return '/images/model-rumion.png'
  if (m.includes('bolero') && !m.includes('camper') && !m.includes('pik') && !m.includes('maxi')) return '/images/model-bolero.jpg'

  if (m.includes('r15')) return '/images/vehicle-r15.jpg'
  if (m.includes('mt-15') || m.includes('mt15')) return '/images/model-mt15.jpg'
  if (m.includes('fz-s') || m.includes('fzs')) return '/images/model-fzs.jpg'
  if (m.includes('fz-x') || m.includes('fzx')) return '/images/model-fzx.webp'
  if (m.includes('aerox')) return '/images/model-aerox155.jpg'
  if (m.includes('classic 350')) return '/images/vehicle-classic350.jpg'
  if (m.includes('hunter 350')) return '/images/vehicle-hunter350.png'
  if (m.includes('bullet 350')) return '/images/model-bullet350.jpg'
  if (m.includes('meteor 350')) return '/images/model-meteor350.jpg'
  if (m.includes('himalayan')) return '/images/model-himalayan.jpg'
  if (m.includes('ns200')) return '/images/model-pulsar-ns200.jpg'
  if (m.includes('pulsar n160') || m.includes('n160')) return '/images/model-pulsar-n160.webp'
  if (m.includes('pulsar 150')) return '/images/model-pulsar-150.jpg'
  if (m.includes('dominar')) return '/images/model-dominar400.jpg'
  if (m.includes('avenger')) return '/images/model-avenger220.jpg'

  if (m.includes('450x')) return '/images/vehicle-ather450x.jpg'
  if (m.includes('450s')) return '/images/model-ather-450s.jpg'
  if (m.includes('rizta')) return '/images/model-ather-rizta.webp'
  if (m.includes('450 apex') || m.includes('apex')) return '/images/model-ather-450-apex.png'
  if (m.includes('450 plus')) return '/images/model-ather-450-plus.jpg'
  if (m.includes('activa 6g')) return '/images/vehicle-activa.jpg'
  if (m.includes('activa 125')) return '/images/model-activa125.png'
  if (m.includes('grazia')) return '/images/model-grazia125.webp'
  if (m.includes('dio 125')) return '/images/model-dio125.jpg'
  if (m.includes('aviator')) return '/images/model-aviator.jpg'
  if (m.includes('jupiter 125')) return '/images/vehicle-jupiter.jpg'
  if (m.includes('jupiter classic')) return '/images/model-jupiter-classic.jpg'
  if (m.includes('scooty pep')) return '/images/model-scooty-pep-plus.png'
  if (m.includes('ntorq')) return '/images/vehicle-ntorq.jpg'
  if (m.includes('iqube')) return '/images/model-iqube.jpg'

  if (m.includes('ace ev')) return '/images/model-ace-ev.jpg'
  if (m.includes('ace gold')) return '/images/vehicle-ace-ev.jpg'
  if (m.includes('intra v30')) return '/images/model-intra-v30.jpg'
  if (m.includes('intra v50')) return '/images/model-intra-v50.jpg'
  if (m.includes('winger')) return '/images/model-winger.png'
  if (m.includes('supro')) return '/images/model-supro.jpg'
  if (m.includes('camper')) return '/images/model-bolero-camper.jpg'
  if (m.includes('treo zor')) return '/images/model-treo-zor.jpg'
  if (m.includes('cruiser van') || m.includes('delivery van')) return '/images/model-trax-delivery-van.jpg'
  if (m.includes('trax cruiser')) return '/images/model-trax-cruiser.jpg'
  if (m.includes('urbania')) return '/images/model-urbania.png'
  if (m.includes('traveller')) return '/images/model-traveller.jpg'
  if (m.includes('shaktiman')) return '/images/model-shaktiman-400.jpg'
  if (m.includes('extralong')) return '/images/model-bolero-extralong.jpg'
  if (m.includes('bolero maxi truck') || (m.includes('bolero pik-up') && !m.includes('extralong'))) return '/images/vehicle-bolero-pikup.jpg'

  return ''
}

// Helper retained for backwards compatibility — never substitutes a misleading model photo
export const getCategoryFallbackImage = () => ''

// Helper to resolve verified vehicle image
export const resolveVehicleImage = (vehicle, explicitSrc = '') => {
  if (explicitSrc && typeof explicitSrc === 'string' && explicitSrc.trim() !== '') {
    return explicitSrc
  }

  if (vehicle && vehicle.image && typeof vehicle.image === 'string' && vehicle.image.trim() !== '') {
    return vehicle.image
  }

  if (vehicle) {
    const strictPath = resolveExactModelImagePath(
      vehicle.make || vehicle.brand || '',
      vehicle.model || vehicle.name || ''
    )
    if (strictPath) return strictPath

    const makeLower = (vehicle.make || vehicle.brand || '').toLowerCase().trim()
    const modelLower = (vehicle.model || vehicle.name || '').toLowerCase().trim()
    if (makeLower && modelLower) {
      const found = catalogVehicles.find((c) => {
        const cBrand = c.brand.toLowerCase()
        const cModel = c.model.toLowerCase()
        return cBrand === makeLower && cModel === modelLower
      })
      if (found && found.image) return found.image
    }
  }

  return ''
}
