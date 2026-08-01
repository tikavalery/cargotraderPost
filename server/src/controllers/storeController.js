import Store, { StoreLog } from '../models/Store.js';
import { Warehouse } from '../models/Warehouse.js';
import Item from '../models/Item.js';
import HeldSale from '../models/HeldSale.js';
import RegisterSession from '../models/RegisterSession.js';
import ApiError, { asyncHandler } from '../utils/ApiError.js';
import { getAssignedStoreId, assertClerkStoreAccess } from '../utils/clerkScope.js';
import { ROLES } from '../constants/roles.js';
import { getStoreInventoryItems } from '../utils/posHelpers.js';
import { formatStockItem, formatWarehouseCard, batchWarehouseStockCounts, timeAgo } from '../utils/warehouseHelpers.js';
import {
  buildStoreCard,
  buildStoreCardsBatch,
  findStore,
  formatStoreLite,
  formatStoreListCard,
  nextStoreId,
  realignStoreIdToCity
} from '../utils/storeHelpers.js';
import { reconcileStoreAssignments } from '../utils/inventoryLocationHelpers.js';
import { reassignUserStoreIds } from '../utils/userBusinessQuery.js';

export const listStores = asyncHandler(async (req, res) => {
  await reconcileStoreAssignments(req.businessId);

  let docs = await Store.find({ business: req.businessId }).sort({ name: 1 });
  // Fix ids that no longer match city (e.g. renamed Douala still on store-yaound)
  const aligned = [];
  for (const doc of docs) {
    aligned.push(await realignStoreIdToCity(req.businessId, doc));
  }
  docs = aligned.map((d) => (d.toObject ? d.toObject() : d));

  const assignedStoreId = getAssignedStoreId(req.userDoc, req.businessId, req.businessRole);
  if (req.businessRole === ROLES.STORE_CLERK) {
    if (!assignedStoreId) {
      docs = [];
    } else {
      docs = docs.filter((d) => d.storeId === assignedStoreId);
    }
  }

  if (req.query.lite === '1') {
    const stores = docs.map(formatStoreLite);
    const cities = new Set(stores.map((s) => s.city).filter(Boolean));
    return res.json({
      ok: true,
      data: stores,
      stores,
      meta: {
        storeCount: stores.length,
        cityCount: cities.size,
        activeCount: stores.filter((s) => s.active).length
      }
    });
  }

  const stores = docs.map(formatStoreListCard);
  const cities = new Set(stores.map((s) => s.city).filter(Boolean));

  res.json({
    ok: true,
    data: stores,
    stores,
    meta: {
      storeCount: stores.length,
      cityCount: cities.size,
      activeCount: stores.filter((s) => s.active).length
    }
  });
});

export const getStore = asyncHandler(async (req, res) => {
  const assignedStoreId = getAssignedStoreId(req.userDoc, req.businessId, req.businessRole);
  if (assignedStoreId && req.params.storeId !== assignedStoreId) {
    throw new ApiError(403, 'Forbidden — insufficient permissions');
  }
  const store = await findStore(req.businessId, req.params.storeId);
  const card = await buildStoreCard(req.businessId, store);
  res.json({ ok: true, data: card });
});

export const getStoreInventory = asyncHandler(async (req, res) => {
  const storeId = req.params.storeId;
  assertClerkStoreAccess(req, storeId);
  await reconcileStoreAssignments(req.businessId);
  const store = await findStore(req.businessId, storeId);
  const card = await buildStoreCard(req.businessId, store);
  const wantsPage = req.query.page != null || req.query.limit != null || req.query.pageSize != null;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || req.query.pageSize, 10) || 25));

  const { items, summary } = await getStoreInventoryItems(req.businessId, storeId, {
    category: req.query.category,
    search: req.query.search,
    inStockOnly: req.query.inStockOnly !== '0'
  });

  if (!wantsPage) {
    return res.json({
      ok: true,
      data: items.map(formatStockItem),
      items: items.map(formatStockItem),
      summary,
      store: card
    });
  }

  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * limit;
  const pageItems = items.slice(start, start + limit).map(formatStockItem);

  res.json({
    ok: true,
    data: pageItems,
    items: pageItems,
    summary,
    store: card,
    pagination: {
      page: safePage,
      pageSize: limit,
      total,
      pages
    }
  });
});

export const getStoreLogs = asyncHandler(async (req, res) => {
  const storeId = req.params.storeId;
  assertClerkStoreAccess(req, storeId);
  const store = await findStore(req.businessId, storeId);
  const logs = await StoreLog.find({ business: req.businessId, storeId: store.storeId })
    .sort({ createdAt: -1 })
    .limit(100);
  res.json({
    ok: true,
    data: logs.map((l) => ({
      ...l.toObject(),
      ago: l.ago || timeAgo(l.createdAt)
    }))
  });
});

export const listTransferWarehouses = asyncHandler(async (req, res) => {
  const docs = await Warehouse.find({ business: req.businessId }).sort({ name: 1 }).lean();
  const stockByWh = await batchWarehouseStockCounts(req.businessId, docs);
  const warehouses = docs.map((wh) => {
    const stats = stockByWh[String(wh._id)] || { itemsCount: 0, valueUsd: 0 };
    return formatWarehouseCard(wh, stats, []);
  });
  res.json({ ok: true, warehouses });
});

/** Active stores available as transfer destinations (optionally exclude source store). */
export const listTransferStores = asyncHandler(async (req, res) => {
  const excludeStoreId = String(req.query.exclude || '').trim();
  let docs = await Store.find({ business: req.businessId, active: { $ne: false } })
    .sort({ name: 1 })
    .lean();
  if (excludeStoreId) {
    docs = docs.filter((d) => String(d.storeId) !== excludeStoreId);
  }
  const stores = await buildStoreCardsBatch(req.businessId, docs);
  res.json({ ok: true, stores });
});

export const createStore = asyncHandler(async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) throw new ApiError(400, 'Store name is required');

  const city = (req.body.city || '').trim();
  const storeId =
    req.body.storeId?.trim() || (await nextStoreId(req.businessId, city || name));

  const existing = await Store.findOne({ business: req.businessId, storeId });
  if (existing) throw new ApiError(409, 'Store ID already exists');

  const doc = await Store.create({
    business: req.businessId,
    storeId,
    name,
    icon: req.body.icon || '🏪',
    address: (req.body.address || '').trim(),
    city,
    locationToken: (req.body.locationToken || city).trim(),
    manager: (req.body.manager || '').trim(),
    phone: (req.body.phone || '').trim(),
    shelfTarget: Math.max(Number(req.body.shelfTarget) || 100, 10),
    active: req.body.active !== false
  });

  const card = await buildStoreCard(req.businessId, doc);
  res.status(201).json({ ok: true, data: card });
});

export const updateStore = asyncHandler(async (req, res) => {
  const store = await findStore(req.businessId, req.params.storeId);
  const fields = ['name', 'icon', 'address', 'city', 'locationToken', 'manager', 'phone', 'active'];
  fields.forEach((f) => {
    if (req.body[f] != null) store[f] = req.body[f];
  });
  if (req.body.shelfTarget != null) {
    store.shelfTarget = Math.max(Number(req.body.shelfTarget), 10);
  }
  await realignStoreIdToCity(req.businessId, store);
  await store.save();

  const card = await buildStoreCard(req.businessId, store);
  res.json({ ok: true, data: card });
});

export const deleteStore = asyncHandler(async (req, res) => {
  const store = await findStore(req.businessId, req.params.storeId);
  const storeId = store.storeId;
  const businessId = req.businessId;

  await Promise.all([
    Item.deleteMany({ business: businessId, storeId }),
    StoreLog.deleteMany({ business: businessId, storeId }),
    HeldSale.deleteMany({ business: businessId, storeId }),
    RegisterSession.deleteMany({ business: businessId, storeId }),
    reassignUserStoreIds(businessId, storeId, ''),
    Store.deleteOne({ _id: store._id })
  ]);

  res.json({ ok: true, message: 'Store deleted' });
});
