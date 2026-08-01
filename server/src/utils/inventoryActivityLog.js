import { Warehouse, WarehouseLog } from '../models/Warehouse.js';
import Store, { StoreLog } from '../models/Store.js';
import {
  findWarehouseByNameLocation,
  findWarehouseForLocation
} from './warehouseHelpers.js';
import { locationLabelForStore, matchesStoreLocation } from './posHelpers.js';
import { isTransitLocation } from './inventoryLocationHelpers.js';

/**
 * Inventory page log = stock entering/leaving inventory (not location transfers).
 * Inbound: purchase receive/qty up, sales return
 * Outbound: sale, purchase delete/qty down, inventory delete
 */
export const INVENTORY_STOCK_SOURCES = [
  'Purchase',
  'Inventory',
  'POS Sale',
  'Sale',
  'Sales Return',
  'Return'
];

export function isInventoryStockLog(entry) {
  const source = String(entry?.source || '').trim();
  return INVENTORY_STOCK_SOURCES.some((s) => s.toLowerCase() === source.toLowerCase());
}

async function resolveLogTarget(businessId, { location, warehouseId, storeId } = {}) {
  const loc = String(location || '').trim();

  // Shipment / in-transit stock must NOT fall back to the first warehouse.
  if (isTransitLocation(loc)) {
    return { kind: 'shipment', locationName: loc };
  }

  if (warehouseId) {
    return { kind: 'warehouse', warehouseId };
  }
  if (storeId) {
    const store = await Store.findOne({ business: businessId, storeId: String(storeId) }).lean();
    if (store) {
      return {
        kind: 'store',
        storeId: store.storeId,
        storeObjectId: store._id,
        locationName: store.name
      };
    }
  }

  const [warehouses, stores] = await Promise.all([
    Warehouse.find({ business: businessId }).select('_id name location').lean(),
    Store.find({ business: businessId, active: { $ne: false } }).lean()
  ]);

  const wh =
    findWarehouseByNameLocation(warehouses, loc) || findWarehouseForLocation(warehouses, loc);
  if (wh) return { kind: 'warehouse', warehouseId: wh._id, locationName: wh.name };

  const store =
    stores.find((s) => loc && loc === locationLabelForStore(s)) ||
    stores.find((s) => loc && matchesStoreLocation(loc, s.storeId, s));
  if (store) {
    return {
      kind: 'store',
      storeId: store.storeId,
      storeObjectId: store._id,
      locationName: store.name
    };
  }

  // Known freeform location (e.g. "Douala Port") — keep the label, don't invent a warehouse.
  if (loc) {
    return { kind: 'shipment', locationName: loc };
  }

  if (warehouses[0]) {
    return { kind: 'warehouse', warehouseId: warehouses[0]._id, locationName: warehouses[0].name };
  }
  if (stores[0]) {
    return {
      kind: 'store',
      storeId: stores[0].storeId,
      storeObjectId: stores[0]._id,
      locationName: stores[0].name
    };
  }
  return null;
}

/**
 * Persist one inbound/outbound inventory movement for the activity log.
 * @param {'inbound'|'outbound'} type
 */
export async function logInventoryActivity({
  businessId,
  type,
  qty,
  desc,
  source = 'Inventory',
  userName = 'System',
  date,
  location,
  warehouseId,
  storeId
} = {}) {
  const amount = Math.abs(Number(qty) || 0);
  if (!businessId || !type || !desc || !amount) return null;

  const target = await resolveLogTarget(businessId, { location, warehouseId, storeId });
  if (!target) return null;

  const payload = {
    business: businessId,
    type,
    desc,
    date: date || new Date().toISOString().slice(0, 10),
    user: userName || 'System',
    source,
    qty: amount,
    ago: 'just now'
  };

  if (target.kind === 'shipment') {
    // Persist without attaching to a warehouse (avoids polluting warehouse detail logs).
    return WarehouseLog.create({
      ...payload,
      locationKind: 'shipment',
      locationLabel: target.locationName || String(location || '').trim() || 'On Transit'
    });
  }

  if (target.kind === 'warehouse') {
    return WarehouseLog.create({
      ...payload,
      warehouse: target.warehouseId,
      locationKind: 'warehouse',
      locationLabel: target.locationName || ''
    });
  }

  return StoreLog.create({
    ...payload,
    store: target.storeObjectId,
    storeId: target.storeId
  });
}

/** Convenience: log from an Item document (delete / adjust). */
export async function logItemActivity(item, { type, qty, desc, source, userName, date } = {}) {
  if (!item) return null;
  return logInventoryActivity({
    businessId: item.business,
    type,
    qty: qty ?? item.qty,
    desc,
    source,
    userName,
    date,
    location: item.location,
    warehouseId: item.warehouse,
    storeId: item.storeId
  });
}
