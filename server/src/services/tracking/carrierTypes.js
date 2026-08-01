/** Shared types / constants for carrier tracking providers. */

export const STATUS_BADGE = {
  Pending: 'badge-pending',
  'In Transit': 'badge-transit',
  Delayed: 'badge-delayed',
  Arrived: 'badge-arrived',
  'At Customs': 'badge-customs',
  Delivered: 'badge-delivered',
  Closed: 'badge-closed',
  Offloaded: 'badge-delivered',
  Cancelled: 'badge-cancelled'
};

/** Ordered journey stages used by mock provider + timeline UI. */
export const TRACKING_STAGES = [
  {
    status: 'Pending',
    carrierStatus: 'LABEL_CREATED',
    description: 'Shipment packed / label created',
    locationKey: 'origin'
  },
  {
    status: 'In Transit',
    carrierStatus: 'DEPARTED_ORIGIN',
    description: 'Left origin — en route to destination',
    locationKey: 'origin'
  },
  {
    status: 'In Transit',
    carrierStatus: 'IN_TRANSIT_OCEAN',
    description: 'In transit on main leg',
    locationKey: 'mid'
  },
  {
    status: 'In Transit',
    carrierStatus: 'ARRIVED_PORT',
    description: 'Arrived at destination port',
    locationKey: 'destPort'
  },
  {
    status: 'At Customs',
    carrierStatus: 'CUSTOMS_HOLD',
    description: 'At customs — clearance in progress',
    locationKey: 'dest'
  },
  {
    status: 'Arrived',
    carrierStatus: 'ARRIVED_DEST',
    description: 'Arrived at destination city',
    locationKey: 'dest'
  },
  {
    status: 'Delivered',
    carrierStatus: 'DELIVERED',
    description: 'Delivered / available for warehouse offload',
    locationKey: 'dest'
  }
];

export function detectCarrierCode(carrier = '', trackingNumber = '') {
  const c = String(carrier).toLowerCase();
  const t = String(trackingNumber).toUpperCase();
  if (c.includes('maersk') || t.startsWith('MAEU')) return 'maersk';
  if (c.includes('cosco') || t.startsWith('COSU') || t.startsWith('MSKU')) return 'cosco';
  if (c.includes('dhl') || /^\d{10,11}$/.test(t.replace(/\s/g, ''))) return 'dhl';
  if (c.includes('msc') || t.startsWith('MSCU')) return 'msc';
  if (c.includes('cma') || t.startsWith('CMAU')) return 'cma-cgm';
  if (c.includes('evergreen') || t.startsWith('EGLV')) return 'evergreen';
  if (c.includes('traveler')) return 'traveler';
  return 'generic';
}
