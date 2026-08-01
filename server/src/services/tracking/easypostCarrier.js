/**
 * EasyPost adapter — ready when EASYPOST_API_KEY is set.
 * Docs: https://docs.easypost.com/docs/trackers
 */
const STATUS_MAP = {
  unknown: 'Pending',
  pre_transit: 'Pending',
  in_transit: 'In Transit',
  out_for_delivery: 'In Transit',
  available_for_pickup: 'Arrived',
  delivered: 'Delivered',
  return_to_sender: 'Delayed',
  failure: 'Delayed',
  cancelled: 'Cancelled',
  error: 'Delayed'
};

export function easypostSupports() {
  return Boolean(process.env.EASYPOST_API_KEY);
}

export async function trackWithEasyPost({ trackingNumber, carrier }) {
  const apiKey = process.env.EASYPOST_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      provider: 'easypost',
      trackingNumber,
      events: [],
      error: 'EASYPOST_API_KEY not configured',
      errorCode: 'UNSUPPORTED'
    };
  }

  try {
    const auth = Buffer.from(`${apiKey}:`).toString('base64');
    const res = await fetch('https://api.easypost.com/v2/trackers', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tracker: {
          tracking_code: trackingNumber,
          carrier: carrier || undefined
        }
      })
    });

    if (!res.ok) {
      return {
        ok: false,
        provider: 'easypost',
        trackingNumber,
        events: [],
        error: `EasyPost API error (${res.status})`,
        errorCode: res.status === 404 ? 'NOT_FOUND' : 'API_DOWN'
      };
    }

    const data = await res.json();
    const details = data.tracking_details || [];
    const events = details.map((d) => {
      const city = d.tracking_location?.city || '';
      const country = d.tracking_location?.country || '';
      return {
        carrierStatus: d.status || d.message || 'unknown',
        status: STATUS_MAP[String(d.status || '').toLowerCase()] || 'In Transit',
        description: d.message || d.status || 'Update',
        city,
        country,
        location: [city, country].filter(Boolean).join(', ') || '',
        occurredAt: d.datetime ? new Date(d.datetime) : new Date()
      };
    });

    return {
      ok: true,
      provider: 'easypost',
      trackingNumber,
      carrierCode: data.carrier || '',
      events
    };
  } catch (err) {
    return {
      ok: false,
      provider: 'easypost',
      trackingNumber,
      events: [],
      error: err.message || 'EasyPost request failed',
      errorCode: 'API_DOWN'
    };
  }
}
