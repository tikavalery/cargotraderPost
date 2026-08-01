/**
 * Parse and normalize cargo location (city + country) from carrier events.
 */

export function parseLocationString(location = '') {
  const raw = String(location || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw) return { city: '', country: '' };
  if (/^at sea/i.test(raw)) return { city: 'At sea', country: '' };

  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      city: parts.slice(0, -1).join(', '),
      country: parts[parts.length - 1]
    };
  }
  return { city: raw, country: '' };
}

/** Pull a readable place name from shipment origin/dest labels (strip flags/noise). */
export function placeFromRouteLabel(label = '') {
  const cleaned = String(label || '')
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return parseLocationString(cleaned);
}

export function formatLocationLabel(city = '', country = '') {
  return [city, country].filter(Boolean).join(', ');
}

/**
 * Apply the latest event location onto a shipment document (denormalized for list UI).
 */
export function applyEventLocation(shipment, event) {
  if (!event) return false;
  const fromFields = {
    city: String(event.city || '').trim(),
    country: String(event.country || '').trim()
  };
  const parsed = fromFields.city || fromFields.country
    ? fromFields
    : parseLocationString(event.location);

  if (!parsed.city && !parsed.country) return false;

  shipment.currentCity = parsed.city || '';
  shipment.currentCountry = parsed.country || '';
  shipment.lastLocationUpdate = event.occurredAt
    ? new Date(event.occurredAt)
    : new Date();
  return true;
}
