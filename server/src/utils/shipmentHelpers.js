import { isValidId } from './ids.js';
import ApiError from './ApiError.js';

const XAF_RATE = 600;

/** Lookup by shipmentId or _id without casting SHP-XXXX to ObjectId */
export function shipmentByIdFilter(businessId, id) {
  const clauses = [{ shipmentId: id }];
  if (id && typeof id === 'string' && isValidId(id)) {
    clauses.push({ _id: id });
  }
  return { business: businessId, $or: clauses };
}

export const DOC_TYPES = {
  invoice: { label: 'Commercial Invoice', icon: 'fa-file-invoice', color: '#E85D26' },
  packing: { label: 'Packing List', icon: 'fa-clipboard-list', color: '#1A3C5E' },
  bl: { label: 'Bill of Lading', icon: 'fa-ship', color: '#2980B9' },
  customs: { label: 'Customs Declaration', icon: 'fa-landmark', color: '#8E44AD' },
  insurance: { label: 'Insurance Certificate', icon: 'fa-shield-alt', color: '#27AE60' },
  origin: { label: 'Certificate of Origin', icon: 'fa-certificate', color: '#F5A623' },
  pod: { label: 'Proof of Delivery', icon: 'fa-truck-loading', color: '#0D9488' },
  duty: { label: 'Duty Payment Receipt', icon: 'fa-receipt', color: '#E74C3C' }
};

export function statusBadgeForStatus(status) {
  const map = {
    'In Transit': 'badge-transit',
    Delayed: 'badge-delayed',
    Arrived: 'badge-arrived',
    'At Customs': 'badge-customs',
    Delivered: 'badge-delivered',
    Closed: 'badge-closed',
    Offloaded: 'badge-offloaded',
    Pending: 'badge-pending'
  };
  return map[status] || 'badge-transit';
}

export function rowTintForStatus(status) {
  if (status === 'Delayed') return 'row-delayed';
  if (status === 'Arrived') return 'row-arrived';
  if (status === 'At Customs') return 'row-customs';
  return '';
}

export function relativeTime(date) {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return String(date);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatEta(eta) {
  if (!eta) return 'TBD';
  const d = new Date(eta);
  if (Number.isNaN(d.getTime())) return String(eta);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatShipmentRow(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  const isTraveler = o.shippingMethod === 'traveler' || /traveler/i.test(o.carrier || '');
  return {
    id: o.shipmentId,
    _id: o._id,
    shipmentId: o.shipmentId,
    origin: o.origin,
    originFlag: o.originFlag,
    originCountry: o.originCountry,
    dest: o.dest,
    destFlag: o.destFlag,
    destCountry: o.destCountry,
    carrier: o.carrier,
    shippingMethod: o.shippingMethod || 'ocean',
    isTraveler,
    status: o.status,
    statusBadge: o.statusBadge || statusBadgeForStatus(o.status),
    eta: formatEta(o.eta),
    etaRaw: o.eta,
    items: o.items || 0,
    weight: o.weight || '—',
    landedCostUsd: o.landedCostUsd || 0,
    goodsCost: o.goodsCost || 0,
    shippingCost: o.shippingCost || 0,
    dutiesCost: o.dutiesCost || 0,
    salesRevenue: o.salesRevenue || 0,
    container: o.container || o.trackingNumber || '',
    trackingNumber: o.trackingNumber || '',
    tracking: o.tracking || null,
    currentCity: o.currentCity || '',
    currentCountry: o.currentCountry || '',
    lastLocationUpdate: o.lastLocationUpdate || null,
    currentLocation: [o.currentCity, o.currentCountry].filter(Boolean).join(', ') || '',
    statusHistory: (o.statusHistory || []).map((h) => ({
      status: h.status,
      note: h.note || '',
      at: h.at || h.createdAt || null
    })),
    warehouseId: o.warehouseId || '',
    warehouseName: o.warehouseName || '',
    mode: o.mode || 'active',
    baleCount: o.baleCount || 0,
    individualCount: o.individualCount || 0,
    updated: relativeTime(o.updatedAt),
    rowTint: rowTintForStatus(o.status),
    routeCount: 1
  };
}

export function formatDocumentRow(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  const meta = DOC_TYPES[o.type] || { label: o.type, icon: 'fa-file', color: '#8A97A8' };
  return {
    id: o.docId,
    _id: o._id,
    docId: o.docId,
    name: o.name,
    type: o.type,
    typeLabel: meta.label,
    typeIcon: meta.icon,
    typeColor: meta.color,
    fileName: o.fileName,
    fileSize: o.fileSize,
    fileUrl: o.fileUrl,
    shipmentId: o.shipmentId,
    route: o.route,
    status: o.status,
    statusLabel: { verified: 'Verified', pending: 'Pending Review', expiring: 'Expiring Soon' }[o.status] || o.status,
    uploaded: new Date(o.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    notes: o.notes
  };
}

export function computeLandedCost({ goods = 0, freight = 0, insurancePct = 2, dutyPct = 18, vatPct = 19.25, clearing = 0, items = 1 }) {
  const insurance = goods * (insurancePct / 100);
  const dutyAmt = (goods + freight) * (dutyPct / 100);
  const vatAmt = (goods + freight + insurance + dutyAmt) * (vatPct / 100);
  const total = goods + freight + insurance + dutyAmt + vatAmt + clearing;
  return {
    insurance,
    dutyAmt,
    vatAmt,
    total,
    perItem: items > 0 ? total / items : total,
    xaf: Math.round(total * XAF_RATE),
    breakdown: [
      { label: 'Goods value', value: goods },
      { label: 'Freight', value: freight },
      { label: 'Insurance', value: insurance },
      { label: 'Import duty', value: dutyAmt },
      { label: 'VAT', value: vatAmt },
      { label: 'Clearing fees', value: clearing }
    ]
  };
}

/** Default clearing estimate ($350) only when there is cargo value; empty shipments stay $0. */
export function resolveClearingFee(goodsUsd, freightUsd, explicitClearing) {
  if (explicitClearing != null && explicitClearing !== '') {
    const n = Number(explicitClearing);
    return Number.isFinite(n) ? n : 0;
  }
  return (Number(goodsUsd) || 0) + (Number(freightUsd) || 0) > 0 ? 350 : 0;
}

async function isShipmentIdTaken(Shipment, businessId, shipmentId) {
  if (await Shipment.exists({ business: businessId, shipmentId })) return true;
  // Legacy global unique index (shipmentId_1) — check cross-tenant until reconciled on startup.
  return Boolean(await Shipment.exists({ shipmentId }));
}

export async function nextShipmentId(businessId, Shipment) {
  const year = new Date().getFullYear();
  const prefix = `SHP-${year}-`;
  const rows = await Shipment.find({
    business: businessId,
    shipmentId: { $regex: `^${prefix}\\d+$` }
  })
    .select('shipmentId')
    .lean();

  let maxNum = 0;
  for (const row of rows) {
    const n = parseInt(row.shipmentId.slice(prefix.length), 10);
    if (!Number.isNaN(n) && n > maxNum) maxNum = n;
  }

  for (let i = 1; i <= 500; i++) {
    const candidate = `${prefix}${String(maxNum + i).padStart(3, '0')}`;
    if (!(await isShipmentIdTaken(Shipment, businessId, candidate))) return candidate;
  }
  throw new ApiError(500, 'Unable to generate a unique shipment ID');
}

/** Use client-provided ID only when unused; otherwise allocate the next free ID. */
export async function resolveShipmentId(businessId, Shipment, requestedId) {
  const trimmed = String(requestedId || '').trim();
  if (trimmed && !(await isShipmentIdTaken(Shipment, businessId, trimmed))) return trimmed;
  return nextShipmentId(businessId, Shipment);
}

export function buildStatsFromCounts(active = {}, completed = {}) {
  const inTransit = active.inTransit || 0;
  const customs = active.atCustoms || 0;
  const arrived = active.arrived || 0;
  const delayed = active.delayed || 0;
  const activeCount = active.count || 0;
  const completedCount = completed.count || 0;
  const valueUsd = active.valueUsd || 0;
  const completedValue = completed.valueUsd || 0;
  const offloadedItems = completed.itemsOffloaded || 0;

  return {
    activeCount,
    completedCount,
    routeCount: active.routeCount || 0,
    inTransit,
    atCustoms: customs,
    arrived,
    delayed,
    inTransitValueUsd: valueUsd,
    avgLandedCostUsd: activeCount ? Math.round(valueUsd / activeCount) : 0,
    onTimePct: 78,
    completedValueUsd: completedValue,
    avgDeliveryDays: 34,
    itemsOffloaded: offloadedItems,
    statusSummary: `${inTransit} in transit, ${customs} customs, ${arrived} arrived, ${delayed} delayed`
  };
}

export function buildStats(active, completed) {
  const inTransit = active.filter((s) => s.status === 'In Transit').length;
  const customs = active.filter((s) => s.status === 'At Customs').length;
  const arrived = active.filter((s) => s.status === 'Arrived').length;
  const delayed = active.filter((s) => s.status === 'Delayed').length;
  const valueUsd = active.reduce((s, r) => s + (r.landedCostUsd || 0), 0);
  const completedValue = completed.reduce((s, r) => s + (r.landedCostUsd || 0), 0);
  const offloadedItems = completed.reduce((s, r) => s + (r.items || 0), 0);
  const routes = new Set(active.map((s) => `${s.origin}-${s.dest}`));

  return {
    activeCount: active.length,
    completedCount: completed.length,
    routeCount: routes.size,
    inTransit,
    atCustoms: customs,
    arrived,
    delayed,
    inTransitValueUsd: valueUsd,
    avgLandedCostUsd: active.length ? Math.round(valueUsd / active.length) : 0,
    onTimePct: 78,
    completedValueUsd: completedValue,
    avgDeliveryDays: 34,
    itemsOffloaded: offloadedItems,
    statusSummary: `${inTransit} in transit, ${customs} customs, ${arrived} arrived, ${delayed} delayed`
  };
}
