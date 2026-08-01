import Item from '../models/Item.js';
import Shipment from '../models/Shipment.js';
import Store from '../models/Store.js';
import { Warehouse } from '../models/Warehouse.js';
import { findWarehouseForLocation, findWarehouseByNameLocation, formatStockItem } from './warehouseHelpers.js';
import { locationLabelForStore, matchesStoreLocation } from './posHelpers.js';

function normalizeLocation(value) {
  return String(value || '').trim();
}

function findStoreForLocation(stores, location, warehouses = []) {
  const loc = normalizeLocation(location);
  if (!loc) return null;
  const exact = stores.find(
    (s) => loc === locationLabelForStore(s) || loc === String(s.name || '').trim()
  );
  if (exact) return exact;
  if (findWarehouseByNameLocation(warehouses, loc)) return null;
  return stores.find((s) => matchesStoreLocation(loc, s.storeId, s)) || null;
}

function applyWarehousePlacement(data, warehouse) {
  data.warehouse = warehouse._id;
  data.storeId = '';
  data.shipment = null;
  data.status = 'Stored';
  data.location = warehouse.name || data.location;
}

/**
 * Keep storeId, warehouse, status, and shipment aligned when location changes.
 */
export async function syncItemPlacementFromLocation(businessId, data, { existing = null } = {}) {
  const location = normalizeLocation(data.location ?? existing?.location);
  if (!location) return data;

  const [warehouses, stores] = await Promise.all([
    Warehouse.find({ business: businessId }).select('name location _id').lean(),
    Store.find({ business: businessId, active: { $ne: false } }).lean()
  ]);

  if (isTransitLocation(location)) {
    data.storeId = '';
    data.warehouse = null;
    data.status = data.status || existing?.status || 'On Ship';
    if (!data.shipment) {
      data.shipment = await resolveShipmentForTransitItem(businessId);
    }
    return data;
  }

  const exactStore = stores.find(
    (s) => location === locationLabelForStore(s) || location === String(s.name || '').trim()
  );
  if (exactStore) {
    data.storeId = exactStore.storeId;
    data.warehouse = null;
    data.shipment = null;
    data.status = 'In Store';
    data.location = locationLabelForStore(exactStore);
    return data;
  }

  // Prefer exact warehouse name before fuzzy city matching.
  const matchedWarehouseByName = findWarehouseByNameLocation(warehouses, location);
  if (matchedWarehouseByName) {
    applyWarehousePlacement(data, matchedWarehouseByName);
    return data;
  }

  const matchedStore = findStoreForLocation(stores, location, warehouses);
  if (matchedStore) {
    data.storeId = matchedStore.storeId;
    data.warehouse = null;
    data.shipment = null;
    data.status = 'In Store';
    data.location = locationLabelForStore(matchedStore);
    return data;
  }

  const matchedWarehouse = findWarehouseForLocation(warehouses, location);
  if (matchedWarehouse) {
    applyWarehousePlacement(data, matchedWarehouse);
    return data;
  }

  // Leaving store shelf for an unrecognised location — still clear store tags.
  if (existing?.storeId || existing?.status === 'In Store') {
    data.storeId = '';
    data.status = 'Stored';
    data.warehouse = null;
    data.shipment = null;
  }

  return data;
}

/** Fix items still tagged as store stock but whose location is a warehouse name. */
export async function reconcileShelfToWarehouse(businessId) {
  const warehouses = await Warehouse.find({ business: businessId }).select('name location _id').lean();
  if (!warehouses.length) return;

  const candidates = await Item.find({
    business: businessId,
    qty: { $gt: 0 },
    status: { $nin: ['Sold', 'Returned'] },
    $or: [{ storeId: { $nin: [null, ''] } }, { status: 'In Store' }]
  })
    .select('_id location storeId status warehouse')
    .lean();

  for (const item of candidates) {
    // Valid store shelf stock — never pull back to warehouse based on city overlap.
    if (item.status === 'In Store' && item.storeId) continue;

    const wh = findWarehouseByNameLocation(warehouses, item.location);
    if (!wh) continue;

    await Item.updateOne(
      { _id: item._id },
      {
        $set: {
          warehouse: wh._id,
          status: 'Stored',
          storeId: '',
          location: wh.name
        },
        $unset: { shipment: '' }
      }
    );
  }
}

/** Clear stale store tags on warehouse / non-shelf stock. */
export async function reconcileOrphanStoreTags(businessId) {
  await Item.updateMany(
    {
      business: businessId,
      qty: { $gt: 0 },
      storeId: { $nin: [null, ''] },
      $or: [
        { warehouse: { $exists: true, $ne: null } },
        { status: { $in: ['Stored', 'On Ship', 'In Transit', 'Low Stock'] } }
      ]
    },
    { $set: { storeId: '' } }
  );
}

export const TRANSIT_LOCATIONS = new Set(['On Transit', 'Douala Port']);
const ACTIVE_SHIPMENT_STATUSES = ['In Transit', 'Delayed', 'At Customs', 'Arrived'];

export function isTransitLocation(location) {
  const loc = String(location || '').trim();
  return TRANSIT_LOCATIONS.has(loc) || /transit/i.test(loc);
}

/** e.g. "On Transit · Guangzhou → Douala" (falls back to shipment id). */
export function formatTransitLocationLabel(shipment) {
  if (!shipment) return 'On Transit';
  const origin = String(shipment.origin || '').trim();
  const dest = String(shipment.dest || shipment.destination || '').trim();
  if (origin && dest) return `On Transit · ${origin} → ${dest}`;
  if (origin || dest) return `On Transit · ${origin || dest}`;
  const sid = String(shipment.shipmentId || '').trim();
  return sid ? `On Transit · ${sid}` : 'On Transit';
}

export function activeStockQuery(extra = {}) {
  return {
    qty: { $gt: 0 },
    status: { $nin: ['Sold', 'Returned'] },
    ...extra
  };
}

/** Assign storeId to shelf stock and clear warehouse references.
 * Also reclaim purchases wrongly saved as Stored/warehouse via a store location name.
 */
export async function reconcileStoreAssignments(businessId) {
  const stores = await Store.find({ business: businessId, active: { $ne: false } }).lean();
  if (!stores.length) return;

  const warehouses = await Warehouse.find({ business: businessId }).select('name location _id').lean();

  const candidates = await Item.find({
    business: businessId,
    qty: { $gt: 0 },
    status: { $nin: ['Sold', 'Returned', 'On Ship'] }
  })
    .select('_id location warehouse storeId status')
    .lean();

  for (const item of candidates) {
    // Exact warehouse name → leave as warehouse stock.
    if (findWarehouseByNameLocation(warehouses, item.location)) continue;

    const store =
      stores.find(
        (s) =>
          item.location === locationLabelForStore(s) ||
          item.location === String(s.name || '').trim()
      ) ||
      (/\b(store|magasin|shop|boutique)\b/i.test(item.location || '')
        ? stores.find((s) => matchesStoreLocation(item.location, s.storeId, s))
        : null);

    if (!store) continue;

    const alreadyCorrect =
      item.status === 'In Store' &&
      String(item.storeId || '') === String(store.storeId) &&
      !item.warehouse;
    if (alreadyCorrect && item.location === locationLabelForStore(store)) continue;

    await Item.updateOne(
      { _id: item._id },
      {
        $set: {
          storeId: store.storeId,
          status: 'In Store',
          location: locationLabelForStore(store)
        },
        $unset: { warehouse: '', shipment: '' }
      }
    );
  }
}

/** Backfill warehouse ObjectId from location text for stored stock. */
export async function attachWarehousesFromLocations(businessId) {
  const warehouses = await Warehouse.find({ business: businessId }).select('name location _id').lean();
  const items = await Item.find({
    business: businessId,
    qty: { $gt: 0 },
    status: { $nin: ['Sold', 'Returned', 'In Store'] },
    location: { $nin: ['', null, ...TRANSIT_LOCATIONS] },
    $and: [
      { $or: [{ storeId: { $exists: false } }, { storeId: null }, { storeId: '' }] },
      { $or: [{ warehouse: { $exists: false } }, { warehouse: null }] }
    ]
  })
    .select('_id location')
    .lean();

  for (const item of items) {
    const wh = findWarehouseForLocation(warehouses, item.location);
    if (wh) {
      await Item.updateOne({ _id: item._id }, { $set: { warehouse: wh._id } });
    }
  }
}

/** Link in-transit items to active shipments up to each shipment's item capacity. */
export async function reconcileShipmentLinks(businessId) {
  const activeShipments = await Shipment.find({
    business: businessId,
    mode: 'active',
    status: { $in: ACTIVE_SHIPMENT_STATUSES }
  })
    .sort({ createdAt: 1 })
    .lean();

  if (!activeShipments.length) return;

  const unlinked = await Item.find({
    business: businessId,
    qty: { $gt: 0 },
    status: { $in: ['On Ship', 'In Transit'] },
    $and: [
      { $or: [{ shipment: { $exists: false } }, { shipment: null }] },
      {
        $or: [
          { location: { $in: [...TRANSIT_LOCATIONS] } },
          { location: { $regex: /transit/i } }
        ]
      }
    ]
  })
    .sort({ createdAt: 1 })
    .lean();

  if (!unlinked.length) return;

  let itemIdx = 0;
  for (const shipment of activeShipments) {
    const cap = Math.max(Number(shipment.items) || 0, 0);
    if (!cap) continue;

    let linked = await Item.countDocuments({ business: businessId, shipment: shipment._id });
    while (linked < cap && itemIdx < unlinked.length) {
      const item = unlinked[itemIdx];
      itemIdx += 1;
      await Item.updateOne(
        { _id: item._id },
        {
          $set: {
            shipment: shipment._id,
            status: 'On Ship',
            location: formatTransitLocationLabel(shipment)
          },
          $unset: { warehouse: '', storeId: '' }
        }
      );
      linked += 1;
    }
  }
}

export async function reconcileInventoryLocations(businessId) {
  await reconcileShelfToWarehouse(businessId);
  await attachWarehousesFromLocations(businessId);
  await reconcileOrphanStoreTags(businessId);
  await reconcileStoreAssignments(businessId);
  await reconcileShipmentLinks(businessId);
}

export async function resolveShipmentForTransitItem(businessId) {
  const shipment = await Shipment.findOne({
    business: businessId,
    mode: 'active',
    status: { $in: ACTIVE_SHIPMENT_STATUSES }
  }).sort({ createdAt: -1 });
  return shipment?._id || null;
}

export async function syncShipmentItemCount(businessId, shipmentId, { session } = {}) {
  // Postgres shim ignores Mongo sessions; keep the arg for call-site compatibility.
  void session;
  const count = await Item.countDocuments({
    business: businessId,
    shipment: shipmentId,
    qty: { $gt: 0 },
    status: { $nin: ['Sold', 'Returned'] }
  });

  await Shipment.updateOne(
    { business: businessId, _id: shipmentId },
    { $set: { items: count } }
  );
  return count;
}

export async function getShipmentItems(businessId, shipment) {
  const shipmentId = shipment._id || shipment;
  await reconcileShipmentLinks(businessId);

  const items = await Item.find({
    business: businessId,
    shipment: shipmentId,
    ...activeStockQuery()
  })
    .sort({ name: 1 })
    .lean();

  return items.map(formatStockItem);
}

export async function offloadShipmentItems(businessId, shipment) {
  const warehouseKey = shipment.warehouseId;
  if (!warehouseKey) return 0;

  const wh = await Warehouse.findOne({
    business: businessId,
    $or: [{ warehouseId: warehouseKey }, { _id: warehouseKey }]
  });
  if (!wh) return 0;

  const result = await Item.updateMany(
    { business: businessId, shipment: shipment._id },
    {
      $set: {
        location: wh.name,
        warehouse: wh._id,
        status: 'Stored'
      },
      $unset: { shipment: '' }
    }
  );
  return result.modifiedCount;
}
