import { TRACKING_STAGES, detectCarrierCode } from './carrierTypes.js';
import { formatLocationLabel, placeFromRouteLabel } from './locationHelpers.js';

/** Typical ocean hubs while cargo is between origin and destination ports. */
const TRANSIT_HUBS = {
  cosco: { city: 'Singapore', country: 'Singapore' },
  maersk: { city: 'Algeciras', country: 'Spain' },
  msc: { city: 'Tangier', country: 'Morocco' },
  'cma-cgm': { city: 'Malta', country: 'Malta' },
  evergreen: { city: 'Colombo', country: 'Sri Lanka' },
  generic: { city: 'At sea', country: '' }
};

function locationPartsFor(key, origin = '', dest = '', carrierCode = 'generic') {
  const originPlace = placeFromRouteLabel(origin);
  const destPlace = placeFromRouteLabel(dest);

  if (key === 'origin') {
    return {
      city: originPlace.city || origin || 'Origin',
      country: originPlace.country || ''
    };
  }
  if (key === 'dest' || key === 'destPort') {
    const city =
      key === 'destPort' && destPlace.city
        ? `${destPlace.city} Port`
        : destPlace.city || dest || 'Destination';
    return {
      city,
      country: destPlace.country || ''
    };
  }
  return TRANSIT_HUBS[carrierCode] || TRANSIT_HUBS.generic;
}

function enrichDescription(base, carrierCode, origin, dest, stageIndex) {
  if (stageIndex === 1 && (carrierCode === 'cosco' || carrierCode === 'maersk' || carrierCode === 'msc')) {
    return `Left ${origin || 'origin port'} — vessel departed`;
  }
  if (stageIndex === 4) {
    return `At customs — awaiting clearance in ${dest || 'destination'}`;
  }
  if (stageIndex === 5) {
    return `Arrived in ${dest || 'destination'}`;
  }
  return base
    .replace('origin', origin || 'origin')
    .replace('destination', dest || 'destination');
}

/**
 * MVP mock carrier — deterministic progression by mockStage.
 * Emits city/country so ocean carriers (COSCO, MSC, Maersk, …) show live-style locations.
 * Response shape matches Shippo/EasyPost adapters for easy swap.
 */
export async function trackWithMock({ trackingNumber, carrier, origin, dest, mockStage = 0 }) {
  const tn = String(trackingNumber || '').trim();
  if (!tn || tn.length < 4) {
    return {
      ok: false,
      provider: 'mock',
      trackingNumber: tn,
      events: [],
      error: 'Invalid tracking number',
      errorCode: 'INVALID_TRACKING'
    };
  }

  // Simulate carrier API outage for numbers ending in 000
  if (/000$/.test(tn.replace(/\W/g, ''))) {
    return {
      ok: false,
      provider: 'mock',
      trackingNumber: tn,
      events: [],
      error: 'Carrier API temporarily unavailable',
      errorCode: 'API_DOWN'
    };
  }

  const carrierCode = detectCarrierCode(carrier, tn);
  const stage = Math.max(0, Math.min(Number(mockStage) || 0, TRACKING_STAGES.length - 1));
  const now = Date.now();

  const events = TRACKING_STAGES.slice(0, stage + 1).map((s, i) => {
    const parts = locationPartsFor(s.locationKey, origin || '', dest || '', carrierCode);
    return {
      carrierStatus: s.carrierStatus,
      status: s.status,
      description: enrichDescription(
        s.description,
        carrierCode,
        origin || 'Origin',
        dest || 'Destination',
        i
      ),
      city: parts.city,
      country: parts.country,
      location: formatLocationLabel(parts.city, parts.country),
      occurredAt: new Date(now - (stage - i) * 36e5)
    };
  });

  return {
    ok: true,
    provider: 'mock',
    trackingNumber: tn,
    carrierCode,
    events
  };
}
