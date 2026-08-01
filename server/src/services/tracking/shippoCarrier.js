/**
 * Shippo adapter — ready when SHIPPO_API_KEY is set.
 * Docs: https://docs.goshippo.com/docs/tracking/tracking/
 */
const STATUS_MAP = {
  UNKNOWN: 'Pending',
  PRE_TRANSIT: 'Pending',
  TRANSIT: 'In Transit',
  FAILURE: 'Delayed',
  RETURNED: 'Delayed',
  AVAILABLE_FOR_PICKUP: 'Arrived',
  DELIVERED: 'Delivered'
};

export function shippoSupports() {
  return Boolean(process.env.SHIPPO_API_KEY);
}

export async function trackWithShippo({ trackingNumber, carrier }) {
  const apiKey = process.env.SHIPPO_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      provider: 'shippo',
      trackingNumber,
      events: [],
      error: 'SHIPPO_API_KEY not configured',
      errorCode: 'UNSUPPORTED'
    };
  }

  try {
    const carrierSlug = encodeURIComponent(carrier || 'shippo');
    const tn = encodeURIComponent(trackingNumber);
    const res = await fetch(`https://api.goshippo.com/tracks/${carrierSlug}/${tn}/`, {
      headers: {
        Authorization: `ShippoToken ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      return {
        ok: false,
        provider: 'shippo',
        trackingNumber,
        events: [],
        error: `Shippo API error (${res.status})`,
        errorCode: res.status === 404 ? 'NOT_FOUND' : 'API_DOWN'
      };
    }

    const data = await res.json();
    const history = data.tracking_history || [];
    const events = history.map((h) => {
      const city = h.location?.city || '';
      const country = h.location?.country || h.location?.country_iso2 || '';
      return {
        carrierStatus: h.status || h.status_details || 'UNKNOWN',
        status: STATUS_MAP[h.status] || 'In Transit',
        description: h.status_details || h.status || 'Update',
        city,
        country,
        location: [city, country].filter(Boolean).join(', ') || '',
        occurredAt: h.status_date ? new Date(h.status_date) : new Date()
      };
    });

    return {
      ok: true,
      provider: 'shippo',
      trackingNumber,
      carrierCode: data.carrier || '',
      events
    };
  } catch (err) {
    return {
      ok: false,
      provider: 'shippo',
      trackingNumber,
      events: [],
      error: err.message || 'Shippo request failed',
      errorCode: 'API_DOWN'
    };
  }
}
