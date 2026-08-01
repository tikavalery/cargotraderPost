import Item from '../models/Item.js';
import { Warehouse } from '../models/Warehouse.js';
import { categoryMeta } from '../constants/inventory.js';

const XAF_PER_USD = 600;

const UTIL_FACTORS = {
  'wh-a': 2.05,
  'wh-b': 1.48,
  'wh-c': 2.93,
  'wh-d': 1.12
};

export const COUNTRY_FLAGS = {
  Cameroon: '🇨🇲',
  Nigeria: '🇳🇬',
  Ghana: '🇬🇭',
  UAE: '🇦🇪',
  'United Arab Emirates': '🇦🇪'
};

export function flagForCountry(country) {
  return COUNTRY_FLAGS[country] || '🏳️';
}

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whether a stock record's location string belongs to this warehouse. */
export function docMatchesWarehouse(doc, warehouse) {
  if (doc.warehouse && String(doc.warehouse) === String(warehouse._id)) return true;
  const loc = (doc.location || '').toLowerCase();
  if (!loc) return false;
  const names = [warehouse.name, warehouse.location].filter(Boolean).map((n) => n.toLowerCase());
  return names.some((n) => loc.includes(n) || n.includes(loc));
}

export function findWarehouseForLocation(warehouses, locationString) {
  if (!locationString?.trim()) return null;
  // Store shelf locations must never fuzzy-match a warehouse via city name
  // (e.g. "Yaounde Store" must not attach to "Yaounde Warehouse").
  if (/\b(store|magasin|shop|boutique)\b/i.test(locationString)) {
    return findWarehouseByNameLocation(warehouses, locationString);
  }

  const normalized = String(locationString)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const exact = warehouses.find((wh) => {
    const names = [wh.name, wh.location].filter(Boolean).map((n) =>
      String(n)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    );
    return names.some((n) => n === normalized);
  });
  if (exact) return exact;

  const stub = { location: locationString.trim() };
  return warehouses.find((wh) => docMatchesWarehouse(stub, wh)) || null;
}

/** Strict match — location must equal the warehouse name (not city substring overlap). */
export function findWarehouseByNameLocation(warehouses, locationString) {
  if (!locationString?.trim()) return null;
  const normalized = String(locationString)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    warehouses.find((wh) => {
      if (!wh.name) return false;
      const name = String(wh.name)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      return name === normalized;
    }) || null
  );
}

export function warehouseMatchFilter(warehouse) {
  const names = [warehouse.name, warehouse.location].filter(Boolean);
  const or = [{ warehouse: warehouse._id }];
  for (const name of names) {
    or.push({ location: name });
    if (name.length >= 3) {
      or.push({ location: new RegExp(escapeRegex(name), 'i') });
    }
  }
  return { $or: or };
}

/** Loose stock visible in a warehouse (excludes shelf stock assigned to a store). */
export function warehouseItemFilter(warehouse) {
  return {
    $and: [
      warehouseMatchFilter(warehouse),
      {
        $or: [{ storeId: { $exists: false } }, { storeId: null }, { storeId: '' }]
      },
      { qty: { $gt: 0 } },
      { status: { $nin: ['Sold', 'Returned', 'In Store'] } }
    ]
  };
}

/** Pick the single warehouse that owns a stock record (avoids double-counting). */
export function warehouseForItem(doc, warehouses) {
  if (doc.storeId) return null;
  if ((doc.qty || 0) <= 0) return null;
  if (['Sold', 'Returned', 'In Store'].includes(doc.status)) return null;

  if (doc.warehouse) {
    const byId = warehouses.find((w) => String(w._id) === String(doc.warehouse));
    if (byId) return byId;
  }
  return warehouses.find((w) => docMatchesWarehouse(doc, w)) || null;
}

export function computeUtilization(warehouseId, itemsCount, capacityM3) {
  const cap = Math.max(capacityM3 || 200, 50);
  const factor = UTIL_FACTORS[warehouseId] || 2.05;
  return Math.min(100, Math.round((itemsCount / (cap * factor)) * 100));
}

/** One pass over all stock — used for warehouse list/dashboard instead of N× queries. */
export async function batchWarehouseStockCounts(businessId, warehouses) {
  if (!warehouses.length) return {};

  const items = await Item.find({ business: businessId }).select('warehouse location qty value storeId status').lean();

  const byWh = Object.fromEntries(
    warehouses.map((wh) => [String(wh._id), { itemsCount: 0, valueXaf: 0 }])
  );

  for (const item of items) {
    const qty = item.qty || 0;
    const value = item.value || 0;
    const wh = warehouseForItem(item, warehouses);
    if (!wh) continue;
    const bucket = byWh[String(wh._id)];
    bucket.itemsCount += qty;
    bucket.valueXaf += value;
  }

  return Object.fromEntries(
    Object.entries(byWh).map(([id, stats]) => [
      id,
      { itemsCount: stats.itemsCount, valueUsd: Math.round(stats.valueXaf / XAF_PER_USD) }
    ])
  );
}

export async function getWarehouseStockCounts(businessId, warehouse) {
  const items = await Item.find({ business: businessId, ...warehouseItemFilter(warehouse) });
  const itemQty = items.reduce((s, i) => s + (i.qty || 0), 0);
  const valueXaf = items.reduce((s, i) => s + (i.value || 0), 0);
  return {
    items,
    itemsCount: itemQty,
    valueUsd: Math.round(valueXaf / XAF_PER_USD)
  };
}

export function deriveStatus(warehouse, utilization) {
  if (warehouse.status === 'Transit Hub') return 'Transit Hub';
  if (utilization >= 85) return 'Critical Capacity';
  if (['Maintenance', 'Closed'].includes(warehouse.status)) return warehouse.status;
  return 'Operational';
}

export function staffInitials(staffList) {
  const active = staffList.filter((s) => s.status !== 'Inactive');
  return active.slice(0, 5).map((s) => {
    const a = (s.firstName || '')[0] || '';
    const b = (s.lastName || '')[0] || '';
    return `${a}${b}`.toUpperCase() || 'ST';
  });
}

export function personInitials(firstName, lastName) {
  const a = (firstName || '')[0] || '';
  const b = (lastName || '')[0] || '';
  return `${a}${b}`.toUpperCase() || 'ST';
}

export function formatWarehouseSummary(warehouse) {
  return {
    id: warehouse.warehouseId,
    name: warehouse.name,
    flag: warehouse.flag || flagForCountry(warehouse.country),
    country: warehouse.country,
    address: warehouse.address || warehouse.location || '',
    manager: warehouse.manager || '—',
    phone: warehouse.phone || ''
  };
}

export function formatStaffRow(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: o.staffId,
    staffId: o.staffId,
    firstName: o.firstName,
    lastName: o.lastName,
    employeeId: o.employeeId || '',
    role: o.role || '',
    department: o.department || '',
    status: o.status || 'Active',
    shift: o.shift || 'Day',
    phone: o.phone || '',
    email: o.email || '',
    startDate: o.startDate || '',
    emergencyContact: o.emergencyContact || '',
    emergencyPhone: o.emergencyPhone || '',
    address: o.address || '',
    notes: o.notes || '',
    avatarColor: o.avatarColor || ''
  };
}

export async function syncWarehouseStaffSummary(businessId, warehouse) {
  const staffList = await import('../models/Warehouse.js').then((m) =>
    m.WarehouseStaff.find({ business: businessId, warehouse: warehouse._id })
  );
  const active = staffList.filter((s) => s.status !== 'Inactive');
  const manager = active.find((s) => /manager/i.test(s.role || ''));
  if (manager) {
    warehouse.manager = `${manager.firstName} ${manager.lastName}`.trim();
    if (manager.phone) warehouse.phone = manager.phone;
  }
  await warehouse.save();
  return { staffCount: active.length, staffInitials: staffInitials(staffList) };
}

export function formatWarehouseListCard(warehouse) {
  return {
    id: warehouse.warehouseId,
    _id: warehouse._id,
    warehouseId: warehouse.warehouseId,
    name: warehouse.name,
    flag: warehouse.flag || flagForCountry(warehouse.country),
    address: warehouse.address || warehouse.location || '',
    country: warehouse.country,
    status: warehouse.status || 'Operational',
    manager: warehouse.manager || '—',
    phone: warehouse.phone || ''
  };
}

export function formatWarehouseCard(warehouse, stats, staffList = []) {
  const utilization = computeUtilization(warehouse.warehouseId, stats.itemsCount, warehouse.capacityM3);
  const status = deriveStatus(warehouse, utilization);
  return {
    id: warehouse.warehouseId,
    _id: warehouse._id,
    warehouseId: warehouse.warehouseId,
    name: warehouse.name,
    flag: warehouse.flag || flagForCountry(warehouse.country),
    address: warehouse.address || warehouse.location || '',
    country: warehouse.country,
    status,
    utilization,
    itemsCount: stats.itemsCount,
    value: stats.valueUsd,
    capacityM3: warehouse.capacityM3 || 200,
    manager: warehouse.manager || '—',
    phone: warehouse.phone || '',
    staffCount: staffList.filter((s) => s.status !== 'Inactive').length,
    staffInitials: staffInitials(staffList),
    critical: utilization >= 85
  };
}

export function formatStockItem(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  const meta = categoryMeta(o.category);
  const mongoId = o._id != null ? String(o._id) : '';
  return {
    id: o.itemId || mongoId,
    _id: mongoId,
    name: o.name,
    sku: o.sku,
    category: o.category,
    qty: o.qty,
    reorder: o.reorder,
    location: o.location,
    status: o.status,
    purchasePrice: o.purchasePrice,
    targetPrice: o.targetPrice || o.priceXaf,
    value: o.value,
    purchaseDate: o.purchaseDate,
    photos: o.photos || [],
    icon: o.icon || meta.icon,
    color: o.color || meta.color,
    notes: o.notes
  };
}

export function timeAgo(date) {
  const d = new Date(date);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export async function nextWarehouseId(businessId) {
  const count = await import('../models/Warehouse.js').then((m) => m.Warehouse.countDocuments({ business: businessId }));
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const letter = letters[count % 26];
  return `wh-${letter}`;
}

export async function nextStaffId() {
  return `stf-${Date.now()}`;
}

/** Link loose stock to a warehouse when location text matches. */
export async function attachWarehouseFromLocation(businessId, data) {
  if (data.warehouse || !data.location?.trim()) return data;
  const warehouses = await Warehouse.find({ business: businessId }).select('name location _id').lean();
  const wh = findWarehouseForLocation(warehouses, data.location);
  if (wh) data.warehouse = wh._id;
  return data;
}
