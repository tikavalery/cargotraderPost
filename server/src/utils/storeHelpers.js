import ApiError from '../utils/ApiError.js';
import Item from '../models/Item.js';
import PosTransaction from '../models/PosTransaction.js';
import RegisterSession from '../models/RegisterSession.js';
import HeldSale from '../models/HeldSale.js';
import SalesReturn from '../models/SalesReturn.js';
import User from '../models/User.js';
import Store, { StoreLog } from '../models/Store.js';
import { itemBelongsToStore, locationLabelForStore, matchesStoreLocation, startOfToday } from './posHelpers.js';
import { reassignUserStoreIds } from './userBusinessQuery.js';

export const CITY_FLAGS = {
  Yaoundé: '🇨🇲',
  Douala: '🇨🇲',
  Kribi: '🇨🇲',
  Bafoussam: '🇨🇲',
  Bamenda: '🇨🇲',
  Limbe: '🇨🇲'
};

const EMPTY_INVENTORY = { itemsCount: 0, valueXaf: 0, skuCount: 0 };
const EMPTY_SALES = { todaySales: 0, todayTransactions: 0, todayUnits: 0 };

export function flagForCity(city) {
  return CITY_FLAGS[city] || '🇨🇲';
}

export async function findStore(businessId, storeId) {
  const store = await Store.findOne({ business: businessId, storeId });
  if (!store) throw new ApiError(404, 'Store not found');
  return store;
}

function toPlainStore(store) {
  return store?.toObject ? store.toObject() : store;
}

function itemValueXaf(item) {
  return item.value || (item.targetPrice || item.priceXaf || 0) * (item.qty || 0);
}

function addItemToInventory(bucket, item) {
  bucket.itemsCount += item.qty || 0;
  bucket.valueXaf += itemValueXaf(item);
  bucket.skuCount += 1;
}

export async function getStoreInventoryStats(businessId, store) {
  const plain = toPlainStore(store);
  const storeId = plain.storeId || store;

  const items = await Item.find({
    business: businessId,
    status: 'In Store',
    warehouse: null,
    qty: { $gt: 0 }
  })
    .select('location storeId warehouse qty value targetPrice priceXaf status')
    .lean();

  const bucket = { ...EMPTY_INVENTORY, skuCount: 0 };
  for (const item of items) {
    if (itemBelongsToStore(item, storeId, plain)) {
      addItemToInventory(bucket, item);
    }
  }
  return bucket;
}

export async function getStoreTodaySales(businessId, storeId) {
  const today = startOfToday();
  const rows = await PosTransaction.find({
    business: businessId,
    storeId,
    status: 'completed',
    date: { $gte: today },
    deletedAt: null
  })
    .select('total itemCount')
    .lean();

  if (!rows.length) return { ...EMPTY_SALES };
  return {
    todaySales: rows.reduce((s, r) => s + (r.total || 0), 0),
    todayTransactions: rows.length,
    todayUnits: rows.reduce((s, r) => s + (r.itemCount || 0), 0)
  };
}

export async function isRegisterOpen(businessId, storeId) {
  const session = await RegisterSession.findOne({
    business: businessId,
    storeId,
    open: true
  })
    .select('_id')
    .lean();
  return Boolean(session);
}

/** One query for all stores — avoids N× full inventory fetches. */
export async function buildStoreCardsBatch(businessId, storeDocs) {
  const stores = storeDocs.map(toPlainStore);
  if (!stores.length) return [];

  const today = startOfToday();
  const inventoryByStore = Object.fromEntries(
    stores.map((s) => [s.storeId, { ...EMPTY_INVENTORY, skuCount: 0 }])
  );

  const [items, salesRows, openSessions] = await Promise.all([
    Item.find({
      business: businessId,
      status: 'In Store',
      warehouse: null,
      qty: { $gt: 0 }
    })
      .select('location storeId warehouse qty value targetPrice priceXaf status')
      .lean(),
    PosTransaction.find({
      business: businessId,
      status: 'completed',
      date: { $gte: today },
      deletedAt: null
    })
      .select('storeId total itemCount')
      .lean(),
    RegisterSession.find({ business: businessId, open: true }).select('storeId').lean()
  ]);

  const salesByStore = {};
  for (const row of salesRows) {
    const key = row.storeId;
    if (!salesByStore[key]) {
      salesByStore[key] = { todaySales: 0, todayTransactions: 0, todayUnits: 0 };
    }
    salesByStore[key].todaySales += row.total || 0;
    salesByStore[key].todayTransactions += 1;
    salesByStore[key].todayUnits += row.itemCount || 0;
  }

  for (const item of items) {
    if (item.warehouse) continue;
    if (item.storeId && inventoryByStore[item.storeId]) {
      const storeDoc = stores.find((s) => s.storeId === item.storeId);
      if (itemBelongsToStore(item, item.storeId, storeDoc)) {
        addItemToInventory(inventoryByStore[item.storeId], item);
      }
      continue;
    }
    for (const store of stores) {
      if (itemBelongsToStore(item, store.storeId, store)) {
        addItemToInventory(inventoryByStore[store.storeId], item);
        break;
      }
    }
  }

  const openSet = new Set(openSessions.map((s) => s.storeId));

  return stores.map((store) =>
    formatStoreCard(
      store,
      inventoryByStore[store.storeId] || { ...EMPTY_INVENTORY },
      salesByStore[store.storeId] || { ...EMPTY_SALES },
      openSet.has(store.storeId)
    )
  );
}

export function computeStockLevel(itemsCount, shelfTarget = 100) {
  const target = Math.max(Number(shelfTarget) || 100, 10);
  return Math.min(100, Math.round((itemsCount / target) * 100));
}

export function deriveStoreStatus(store, registerOpen) {
  if (!store.active) return 'Inactive';
  return registerOpen ? 'Open' : 'Closed';
}

export function formatStoreCard(store, inventory, sales, registerOpen) {
  const stockLevel = computeStockLevel(inventory.itemsCount, store.shelfTarget);
  const status = deriveStoreStatus(store, registerOpen);
  const addressLine = [store.address, store.city].filter(Boolean).join(', ') || store.city || '—';

  return {
    id: store.storeId,
    storeId: store.storeId,
    _id: store._id,
    name: store.name,
    icon: store.icon || '🏪',
    flag: flagForCity(store.city),
    address: addressLine,
    city: store.city || '',
    locationToken: store.locationToken || store.city || '',
    status,
    stockLevel,
    itemsCount: inventory.itemsCount,
    valueXaf: inventory.valueXaf,
    todaySales: sales.todaySales,
    todayTransactions: sales.todayTransactions,
    todayUnits: sales.todayUnits,
    registerOpen,
    manager: store.manager || '—',
    phone: store.phone || '',
    shelfTarget: store.shelfTarget || 100,
    active: store.active !== false,
    lowStock: stockLevel < 25
  };
}

export function formatStoreListCard(store) {
  const plain = toPlainStore(store);
  const addressLine = [plain.address, plain.city].filter(Boolean).join(', ') || plain.city || '—';
  return {
    id: plain.storeId,
    storeId: plain.storeId,
    _id: plain._id,
    name: plain.name,
    icon: plain.icon || '🏪',
    flag: flagForCity(plain.city),
    address: addressLine,
    city: plain.city || '',
    status: plain.active !== false ? 'Closed' : 'Inactive',
    active: plain.active !== false
  };
}

export function formatStoreLite(store) {
  const plain = toPlainStore(store);
  return {
    storeId: plain.storeId,
    name: plain.name,
    icon: plain.icon || '🏪',
    address: plain.address || '',
    city: plain.city || '',
    locationToken: plain.locationToken || plain.city || '',
    active: plain.active !== false
  };
}

export async function buildStoreCard(businessId, store) {
  const plain = toPlainStore(store);
  const [inventory, sales, registerOpen] = await Promise.all([
    getStoreInventoryStats(businessId, plain),
    getStoreTodaySales(businessId, plain.storeId),
    isRegisterOpen(businessId, plain.storeId)
  ]);
  return formatStoreCard(plain, inventory, sales, registerOpen);
}

/** Slug used inside store-XXXX ids (city / name). */
export function storeIdSlug(seed = '') {
  return (
    String(seed || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 8) || 'store'
  );
}

function storeIdToken(storeId = '') {
  return String(storeId || '')
    .replace(/^store-/i, '')
    .replace(/-\d+$/, '');
}

export async function nextStoreId(businessId, seed = '', { excludeStoreId } = {}) {
  const base = storeIdSlug(seed);
  let n = 1;
  let candidate = `store-${base}`;
  while (true) {
    const existing = await Store.findOne({ business: businessId, storeId: candidate }).lean();
    if (!existing || (excludeStoreId && existing.storeId === excludeStoreId)) break;
    n += 1;
    candidate = `store-${base}-${n}`;
  }
  return candidate;
}

/** Move all storeId references when a store’s public id changes. */
export async function migrateStoreId(businessId, fromId, toId) {
  if (!businessId || !fromId || !toId || fromId === toId) return;
  const filter = { business: businessId, storeId: fromId };

  await Promise.all([
    Item.updateMany(filter, { $set: { storeId: toId } }),
    StoreLog.updateMany(filter, { $set: { storeId: toId } }),
    HeldSale.updateMany(filter, { $set: { storeId: toId } }),
    RegisterSession.updateMany(filter, { $set: { storeId: toId } }),
    PosTransaction.updateMany(filter, { $set: { storeId: toId } }),
    SalesReturn.updateMany(filter, { $set: { storeId: toId } }),
    reassignUserStoreIds(businessId, fromId, toId)
  ]);
}

/**
 * If the store city no longer matches its id (e.g. renamed Yaoundé → Douala
 * but id stayed store-yaound), rewrite the id and migrate references.
 * Skips legacy short codes (store-yde / store-dla / store-kri).
 */
export async function realignStoreIdToCity(businessId, store) {
  if (!store?.storeId) return store;
  const city = String(store.city || '').trim();
  if (!city) return store;

  const idTok = storeIdToken(store.storeId);
  const cityTok = storeIdSlug(city);
  if (!idTok || !cityTok || idTok === cityTok) return store;

  // Preserve seeded short ids
  if (['yde', 'dla', 'kri'].includes(idTok)) return store;

  const oldId = store.storeId;
  const newId = await nextStoreId(businessId, city, { excludeStoreId: oldId });
  if (newId === oldId) return store;

  await migrateStoreId(businessId, oldId, newId);
  await Store.updateOne({ _id: store._id }, { $set: { storeId: newId } });
  store.storeId = newId;
  return store;
}
