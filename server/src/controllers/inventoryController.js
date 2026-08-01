import { isValidId } from '../utils/ids.js';
import Item from '../models/Item.js';
import Business from '../models/Business.js';
import Shipment from '../models/Shipment.js';
import { Warehouse, WarehouseLog } from '../models/Warehouse.js';
import Store, { StoreLog } from '../models/Store.js';
import { Purchase, Supplier } from '../models/Purchase.js';
import ApiError, { asyncHandler } from '../utils/ApiError.js';
import { enforceInventoryItemLimit } from '../utils/inventoryPlanEnforcement.js';
import { createResourceController } from './resourceController.js';
import { categoryMeta, syncItemPricing } from '../constants/inventory.js';
import { invalidateFinanceSync } from '../services/financeSync.service.js';
import { attachWarehouseFromLocation, timeAgo } from '../utils/warehouseHelpers.js';
import {
  formatTransitLocationLabel,
  isTransitLocation,
  syncItemPlacementFromLocation
} from '../utils/inventoryLocationHelpers.js';
import { isInventoryStockLog, logItemActivity } from '../utils/inventoryActivityLog.js';
import { getAssignedStoreId, filterItemsForClerk, clerkLocationNames } from '../utils/clerkScope.js';
import {
  getAssignedWarehouseIds,
  getEffectiveWarehouseIds,
  buildWarehouseItemScopeFilter,
  filterItemsForWarehouseWorker,
  assertWarehouseAccess,
  isWarehouseWorkerRole,
  loadAssignedWarehouses,
  warehouseDisplayName,
  assertWorkerItemAccess
} from '../utils/warehouseScope.js';
import { ROLES } from '../constants/roles.js';
import { locationLabelForStore } from '../utils/posHelpers.js';
import { ensureCloudPhotos } from '../utils/ensureCloudPhotos.js';

async function rememberInventoryGroup(businessId, groupName) {
  const name = normalizeGroup(groupName);
  if (!name) return;
  await Business.updateOne(
    { _id: businessId },
    { $addToSet: { inventoryGroups: name } }
  );
}

function looseFilter(businessId, query = {}) {
  const filter = {
    business: businessId,
    status: { $ne: 'Returned' },
    $or: [{ bale: null }, { bale: { $exists: false } }]
  };
  const includeZero =
    query.includeZeroQty === '1' ||
    query.includeZeroQty === 'true' ||
    query.includeZeroQty === true;
  if (!includeZero) {
    filter.qty = { $gt: 0 };
  }
  if (query.category) filter.category = query.category;
  if (query.location) {
    const q = query.location.trim();
    filter.location = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }
  applyGroupFilter(filter, query.group);
  if (query.search) {
    const q = query.search.trim();
    filter.$and = [
      ...(filter.$and || []),
      {
        $or: [
          { name: { $regex: q, $options: 'i' } },
          { sku: { $regex: q, $options: 'i' } },
          { itemId: { $regex: q, $options: 'i' } },
          { purchaseId: { $regex: q, $options: 'i' } },
          { group: { $regex: q, $options: 'i' } }
        ]
      }
    ];
  }
  return filter;
}

async function nextItemId(businessId) {
  const count = await Item.countDocuments({ business: businessId });
  return `ITM-${String(count + 1).padStart(3, '0')}`;
}

function applyCategoryDefaults(data) {
  const meta = categoryMeta(data.category);
  data.icon = meta.icon;
  data.color = meta.color;
  return data;
}

function normalizeGroup(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function applyGroupFilter(filter, groupQuery) {
  if (!groupQuery) return;
  if (groupQuery === '__ungrouped__') {
    filter.$and = [
      ...(filter.$and || []),
      { $or: [{ group: null }, { group: '' }, { group: { $exists: false } }] }
    ];
    return;
  }
  filter.group = String(groupQuery).trim();
}

export const listLoose = asyncHandler(async (req, res) => {
  const filter = looseFilter(req.businessId, req.query);

  const assignedStoreId = getAssignedStoreId(req.userDoc, req.businessId, req.businessRole);
  const whIds = await getEffectiveWarehouseIds(req);

  if (req.businessRole === ROLES.STORE_CLERK && !assignedStoreId) {
    return res.json({ ok: true, data: [], pagination: { page: 1, pageSize: 25, total: 0, pages: 1 } });
  }
  if (whIds !== null && !whIds.length) {
    return res.json({ ok: true, data: [], pagination: { page: 1, pageSize: 25, total: 0, pages: 1 } });
  }

  if (whIds?.length) {
    const whScope = await buildWarehouseItemScopeFilter(req.businessId, whIds);
    filter.$and = [...(filter.$and || []), whScope];
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.limit || req.query.pageSize, 10) || 25));
  const skip = (page - 1) * pageSize;

  const [total, slice] = await Promise.all([
    Item.countDocuments(filter),
    Item.find(filter).sort({ updatedAt: -1, name: 1 }).skip(skip).limit(pageSize).lean()
  ]);

  let data = slice;

  if (assignedStoreId) {
    data = await filterItemsForClerk(data, req.businessId, assignedStoreId, req.businessRole);
  } else if (whIds?.length) {
    data = await filterItemsForWarehouseWorker(data, req.businessId, whIds, req.businessRole);
  }

  const shipmentIds = [
    ...new Set(data.map((i) => i.shipment).filter(Boolean).map((id) => String(id)))
  ];
  if (shipmentIds.length) {
    const shipments = await Shipment.find({
      _id: { $in: shipmentIds },
      business: req.businessId
    })
      .select('shipmentId origin dest')
      .lean();
    const byId = new Map(shipments.map((s) => [String(s._id), s]));
    data = data.map((item) => {
      if (!item.shipment) return item;
      const shp = byId.get(String(item.shipment));
      if (!shp) return item;
      const loc = String(item.location || '').trim();
      if (!loc || isTransitLocation(loc)) {
        return {
          ...item,
          location: formatTransitLocationLabel(shp),
          shipmentId: shp.shipmentId || item.shipmentId
        };
      }
      return { ...item, shipmentId: shp.shipmentId || item.shipmentId };
    });
  }

  res.json({
    ok: true,
    data,
    pagination: {
      page,
      pageSize,
      total,
      pages: Math.max(1, Math.ceil(total / pageSize))
    }
  });
});

/**
 * Inventory stock log (enter/leave inventory only).
 * Inbound: purchases, purchase qty increases, sales returns
 * Outbound: sales, purchase deletes / qty decreases, inventory deletes
 * Location transfers are excluded (they stay on warehouse/store detail logs).
 */
export const listActivityLog = asyncHandler(async (req, res) => {
  const type = String(req.query.type || 'all').toLowerCase();
  const locationKind = String(req.query.locationKind || 'all').toLowerCase();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(req.query.limit || req.query.pageSize, 10) || 25)
  );
  const search = String(req.query.search || '').trim().toLowerCase();

  const typeFilter =
    type === 'inbound' || type === 'outbound' ? { type } : {};
  const sourceFilter = {
    source: { $in: ['Purchase', 'Inventory', 'POS Sale', 'Sale', 'Sales Return', 'Return'] }
  };
  const includePurchases = type === 'all' || type === 'inbound';
  /** Pool size for merge (warehouse + store + purchase synthetic rows). */
  const fetchLimit = 500;

  const [whLogs, storeLogs, purchases, warehouses, stores] = await Promise.all([
    locationKind === 'store'
      ? Promise.resolve([])
      : WarehouseLog.find({ business: req.businessId, ...typeFilter, ...sourceFilter })
          .sort({ createdAt: -1 })
          .limit(fetchLimit)
          .lean(),
    locationKind === 'warehouse'
      ? Promise.resolve([])
      : StoreLog.find({ business: req.businessId, ...typeFilter, ...sourceFilter })
          .sort({ createdAt: -1 })
          .limit(fetchLimit)
          .lean(),
    includePurchases
      ? Purchase.find({ business: req.businessId, status: 'saved' })
          .sort({ updatedAt: -1 })
          .limit(fetchLimit)
          .select('purchaseId itemName quantity location purchaseDate createdAt updatedAt')
          .lean()
      : Promise.resolve([]),
    Warehouse.find({ business: req.businessId }).select('_id name').lean(),
    Store.find({ business: req.businessId }).select('_id storeId name').lean()
  ]);

  const purchaseIdFromDesc = (desc) => {
    const m = String(desc || '').match(/\((PUR-[^)]+)\)/i);
    return m ? m[1] : '';
  };

  // Resolve purchase/item locations for every PUR-id mentioned in warehouse/store logs
  const logPurchaseIds = [
    ...new Set(
      [...whLogs, ...storeLogs]
        .map((l) => purchaseIdFromDesc(l.desc))
        .filter(Boolean)
    )
  ];
  const knownIds = new Set(purchases.map((p) => String(p.purchaseId || '').toUpperCase()));
  const missingPurchaseIds = logPurchaseIds.filter((id) => !knownIds.has(id.toUpperCase()));
  const extraPurchases = missingPurchaseIds.length
    ? await Purchase.find({
        business: req.businessId,
        purchaseId: { $in: missingPurchaseIds }
      })
        .select('purchaseId itemName quantity location purchaseDate createdAt updatedAt')
        .lean()
    : [];
  const allPurchases = [...purchases, ...extraPurchases];

  const allPurchaseIdKeys = [
    ...new Set([
      ...logPurchaseIds,
      ...allPurchases.map((p) => String(p.purchaseId || '')).filter(Boolean)
    ])
  ];
  const linkedItems = allPurchaseIdKeys.length
    ? await Item.find({
        business: req.businessId,
        purchaseId: { $in: allPurchaseIdKeys }
      })
        .select('purchaseId location shipment')
        .populate('shipment', 'origin dest shipmentId')
        .lean()
    : [];

  const itemLocByPurchaseId = new Map();
  for (const item of linkedItems) {
    const pid = String(item.purchaseId || '').toUpperCase();
    if (!pid) continue;
    let loc = String(item.location || '').trim();
    if (item.shipment) {
      loc = formatTransitLocationLabel(item.shipment) || loc || 'On Transit';
    }
    if (loc) itemLocByPurchaseId.set(pid, loc);
  }

  const whNameById = new Map(warehouses.map((w) => [String(w._id), w.name]));
  const storeNameById = new Map(stores.map((s) => [String(s.storeId), s.name]));
  const storeNames = new Set(stores.map((s) => String(s.name || '').toLowerCase()));

  const purchaseLocById = new Map();
  for (const p of allPurchases) {
    const pid = String(p.purchaseId || '').toUpperCase();
    if (!pid) continue;
    const fromItem = itemLocByPurchaseId.get(pid);
    const fromPurchase = String(p.location || '').trim();
    purchaseLocById.set(pid, fromItem || fromPurchase);
  }
  for (const [pid, loc] of itemLocByPurchaseId) {
    if (!purchaseLocById.has(pid)) purchaseLocById.set(pid, loc);
  }

  const resolvePurchaseLocation = (desc) => {
    const pid = purchaseIdFromDesc(desc);
    return pid ? purchaseLocById.get(pid.toUpperCase()) || '' : '';
  };

  const classifyLocation = ({ locationKind: kind, locationLabel, location, warehouseId }) => {
    const label = String(locationLabel || location || '').trim();
    if (kind === 'shipment' || isTransitLocation(label)) {
      return { locationKind: 'shipment', locationName: label || 'On Transit' };
    }
    if (kind === 'store') {
      return { locationKind: 'store', locationName: label || 'Store' };
    }
    if (warehouseId) {
      return {
        locationKind: 'warehouse',
        locationName: label || whNameById.get(String(warehouseId)) || 'Warehouse'
      };
    }
    if (label) {
      const isStore = [...storeNames].some((n) => n && label.toLowerCase().includes(n));
      if (isStore) return { locationKind: 'store', locationName: label };
      if (isTransitLocation(label)) return { locationKind: 'shipment', locationName: label };
      return { locationKind: 'warehouse', locationName: label };
    }
    return { locationKind: 'warehouse', locationName: 'Warehouse' };
  };

  // Avoid double-counting purchases already written as WarehouseLog/StoreLog (source: Purchase)
  const purchaseLoggedKeys = new Set(
    [...whLogs, ...storeLogs]
      .filter((l) => String(l.source || '').toLowerCase() === 'purchase')
      .map((l) => String(l.desc || ''))
  );

  const mapped = [
    ...whLogs.map((l) => {
      const purchaseLoc = resolvePurchaseLocation(l.desc);
      const isPurchaseLog = String(l.source || '').toLowerCase() === 'purchase';
      const preferredLabel =
        (isPurchaseLog && purchaseLoc) || l.locationLabel || purchaseLoc || '';
      const classified = classifyLocation({
        locationKind: l.locationKind,
        locationLabel: preferredLabel,
        location: purchaseLoc,
        warehouseId: isPurchaseLog && isTransitLocation(preferredLabel) ? null : l.warehouse
      });
      if (isPurchaseLog && isTransitLocation(preferredLabel)) {
        classified.locationKind = 'shipment';
        classified.locationName = preferredLabel || 'On Transit';
      }
      return {
        ...l,
        id: String(l._id),
        ...classified,
        ago: l.ago || timeAgo(l.createdAt)
      };
    }),
    ...storeLogs.map((l) => ({
      ...l,
      id: String(l._id),
      locationKind: 'store',
      locationName: storeNameById.get(String(l.storeId)) || l.storeId || 'Store',
      ago: l.ago || timeAgo(l.createdAt)
    })),
    ...allPurchases.map((p) => {
      const qty = Math.max(Number(p.quantity) || 0, 0);
      const pid = String(p.purchaseId || '').toUpperCase();
      const loc = purchaseLocById.get(pid) || String(p.location || '').trim();
      const isStore = loc && [...storeNames].some((n) => n && loc.toLowerCase().includes(n));
      const desc = `Received ${qty}× ${p.itemName || 'Item'} from purchase${p.purchaseId ? ` (${p.purchaseId})` : ''}`;
      const classified = isTransitLocation(loc)
        ? { locationKind: 'shipment', locationName: loc || 'On Transit' }
        : isStore
          ? { locationKind: 'store', locationName: loc || 'Store' }
          : { locationKind: 'warehouse', locationName: loc || 'Warehouse' };
      return {
        _id: p._id,
        id: `purchase-${p._id}`,
        type: 'inbound',
        desc,
        date: p.purchaseDate
          ? new Date(p.purchaseDate).toISOString().slice(0, 10)
          : new Date(p.createdAt || Date.now()).toISOString().slice(0, 10),
        user: 'System',
        source: 'Purchase',
        qty,
        createdAt: p.updatedAt || p.createdAt || p.purchaseDate,
        ...classified,
        ago: timeAgo(p.updatedAt || p.createdAt || p.purchaseDate),
        _purchaseSynthetic: true,
        _descKey: desc
      };
    })
  ]
    .filter((l) => {
      if (!isInventoryStockLog(l)) return false;
      // Prefer real WarehouseLog/StoreLog rows when both exist for the same purchase text
      if (l._purchaseSynthetic && purchaseLoggedKeys.has(l._descKey)) return false;
      // Synthetic purchase rows only cover receives (inbound)
      if (l._purchaseSynthetic && type === 'outbound') return false;
      if (locationKind === 'warehouse' && l.locationKind !== 'warehouse') return false;
      if (locationKind === 'store' && l.locationKind !== 'store') return false;
      if (locationKind === 'shipment' && l.locationKind !== 'shipment') return false;
      if (!search) return true;
      const hay = `${l.desc || ''} ${l.user || ''} ${l.source || ''} ${l.locationName || ''}`.toLowerCase();
      return hay.includes(search);
    })
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  const total = mapped.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pages);
  const start = (safePage - 1) * pageSize;
  const pageRows = mapped.slice(start, start + pageSize);

  const inboundCount = mapped.filter((l) => l.type === 'inbound').length;
  const outboundCount = mapped.filter((l) => l.type === 'outbound').length;

  res.json({
    ok: true,
    data: pageRows,
    summary: {
      total,
      inbound: inboundCount,
      outbound: outboundCount
    },
    pagination: {
      page: safePage,
      pageSize,
      total,
      pages
    }
  });
});

/** Catalog + in-use group names for filters and item forms */
export const listItemGroups = asyncHandler(async (req, res) => {
  const base = {
    business: req.businessId,
    status: { $ne: 'Returned' },
    $or: [{ bale: null }, { bale: { $exists: false } }],
    group: { $nin: [null, ''] }
  };
  const [business, used] = await Promise.all([
    Business.findById(req.businessId).select('inventoryGroups').lean(),
    Item.distinct('group', base)
  ]);
  const catalog = (business?.inventoryGroups || []).map(String);
  const merged = new Set(
    [...catalog, ...used].map((g) => String(g || '').trim()).filter(Boolean)
  );
  res.json({
    ok: true,
    data: [...merged].sort((a, b) => a.localeCompare(b))
  });
});

export const createItemGroup = asyncHandler(async (req, res) => {
  const name = normalizeGroup(req.body?.name ?? req.body?.group);
  if (!name) throw new ApiError(400, 'Group name is required');
  if (name.length > 80) throw new ApiError(400, 'Group name must be 80 characters or fewer');

  const business = await Business.findById(req.businessId).select('inventoryGroups');
  if (!business) throw new ApiError(404, 'Business not found');

  const exists = (business.inventoryGroups || []).some(
    (g) => String(g).toLowerCase() === name.toLowerCase()
  );
  if (exists) {
    return res.json({ ok: true, data: { name }, message: 'Group already exists' });
  }

  business.inventoryGroups = [...(business.inventoryGroups || []), name];
  await business.save();
  res.status(201).json({ ok: true, data: { name }, message: 'Group created' });
});

export const removeItemGroup = asyncHandler(async (req, res) => {
  const name = normalizeGroup(decodeURIComponent(req.params.name || ''));
  if (!name) throw new ApiError(400, 'Group name is required');

  const business = await Business.findById(req.businessId).select('inventoryGroups');
  if (!business) throw new ApiError(404, 'Business not found');

  const before = business.inventoryGroups?.length || 0;
  business.inventoryGroups = (business.inventoryGroups || []).filter(
    (g) => String(g).toLowerCase() !== name.toLowerCase()
  );
  const removedFromCatalog = business.inventoryGroups.length !== before;
  if (removedFromCatalog) await business.save();

  // Case-insensitive clear so "Shoes" / "shoes" both unassign
  const clearResult = await Item.updateMany(
    {
      business: req.businessId,
      group: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
    },
    { $set: { group: null } }
  );
  const clearedItems = clearResult.modifiedCount || 0;

  if (!removedFromCatalog && clearedItems === 0) {
    throw new ApiError(404, 'Group not found');
  }

  res.json({
    ok: true,
    data: { name, clearedItems, removedFromCatalog },
    message:
      clearedItems > 0
        ? `Group deleted. ${clearedItems} item${clearedItems === 1 ? '' : 's'} unassigned.`
        : 'Group deleted from list.'
  });
});

export const getLooseOne = asyncHandler(async (req, res) => {
  const doc = await Item.findOne({
    _id: req.params.id,
    business: req.businessId,
    status: { $ne: 'Returned' }
  });
  if (!doc) throw new ApiError(404, 'Item not found');

  const assignedStoreId = getAssignedStoreId(req.userDoc, req.businessId, req.businessRole);
  const whIds = getAssignedWarehouseIds(req.userDoc, req.businessId, req.businessRole);
  if (req.businessRole === ROLES.STORE_CLERK && !assignedStoreId) {
    throw new ApiError(404, 'Item not found');
  }
  if (whIds !== null && !whIds.length) {
    throw new ApiError(404, 'Item not found');
  }
  if (assignedStoreId) {
    const scoped = await filterItemsForClerk([doc], req.businessId, assignedStoreId, req.businessRole);
    if (!scoped.length) throw new ApiError(404, 'Item not found');
  } else if (whIds?.length) {
    const scoped = await filterItemsForWarehouseWorker([doc], req.businessId, whIds, req.businessRole);
    if (!scoped.length) throw new ApiError(404, 'Item not found');
  }

  let supplier = null;
  if (doc.supplierId) {
    supplier = await Supplier.findById(doc.supplierId).select('name country');
  }

  const data = doc.toObject();
  data.id = data.itemId || String(data._id);
  if (supplier) {
    data.supplier = { id: String(supplier._id), name: supplier.name, country: supplier.country };
  }

  res.json({ ok: true, data });
});

export const createLoose = asyncHandler(async (req, res) => {
  await enforceInventoryItemLimit(req.businessId, Item);
  const body = { ...req.body, business: req.businessId, createdBy: req.userDoc._id };
  if (!body.sku) body.sku = `SKU-${Date.now()}`;
  if (!body.itemId) body.itemId = await nextItemId(req.businessId);
  if (!body.status) body.status = 'Stored';
  if (!body.purchaseDate) body.purchaseDate = new Date().toISOString().slice(0, 10);
  if ('group' in body) body.group = normalizeGroup(body.group);
  applyCategoryDefaults(body);
  syncItemPricing(body);
  if (body.location !== undefined) {
    await syncItemPlacementFromLocation(req.businessId, body);
  } else {
    await attachWarehouseFromLocation(req.businessId, body);
  }
  if (isWarehouseWorkerRole(req.businessRole)) {
    await assertWorkerItemAccess(req, body);
  }
  if (body.photos) {
    body.photos = await ensureCloudPhotos(body.photos, { businessId: req.businessId });
  }
  const doc = await Item.saveNew(body);
  if (doc.group) await rememberInventoryGroup(req.businessId, doc.group);
  if ((Number(doc.purchasePrice) || 0) > 0 || (Number(doc.purchaseValue) || 0) > 0) {
    invalidateFinanceSync(req.businessId);
  }
  res.status(201).json({ ok: true, data: doc });
});

export const updateLoose = asyncHandler(async (req, res) => {
  const existing = await Item.findOne({ _id: req.params.id, business: req.businessId });
  if (!existing) throw new ApiError(404, 'Item not found');
  await assertWorkerItemAccess(req, existing);

  const body = { ...req.body };
  delete body.business;
  // Qty must not change via edit — use purchases, transfers, sales, returns, or write-offs.
  delete body.qty;
  // Purchase cost is owned by Purchases → Finance ledger; do not change from inventory edit.
  delete body.purchasePrice;
  delete body.purchaseValue;
  if (body.photos) {
    body.photos = await ensureCloudPhotos(body.photos, { businessId: req.businessId });
  }
  if ('group' in body) body.group = normalizeGroup(body.group);
  if (body.group) await rememberInventoryGroup(req.businessId, body.group);
  if (body.category) applyCategoryDefaults(body);
  // Recalculate retail totals from existing on-hand qty when target price changes.
  // Prices are stored in XAF; value = unit target × on-hand qty.
  const onHand = Math.max(Number(existing.qty) || 0, 0);
  if (body.targetPrice != null) {
    const unitXaf = Math.round(Number(body.targetPrice) || 0);
    body.targetPrice = unitXaf;
    body.priceXaf = unitXaf;
    body.value = unitXaf * onHand;
  } else {
    syncItemPricing({ ...body, qty: existing.qty, purchasePrice: existing.purchasePrice });
  }
  if (body.location !== undefined) {
    await syncItemPlacementFromLocation(req.businessId, body, { existing: existing.toObject() });
  } else if (body.warehouse === undefined && existing.warehouse) {
    body.warehouse = existing.warehouse;
  } else {
    await attachWarehouseFromLocation(req.businessId, body);
  }
  if (isWarehouseWorkerRole(req.businessRole)) {
    await assertWorkerItemAccess(req, { ...existing.toObject(), ...body });
  }

  const fields = [
    'name', 'sku', 'category', 'group', 'reorder', 'location',
    'targetPrice', 'value', 'priceXaf',
    'supplierId', 'purchaseDate', 'notes', 'photos', 'icon', 'color',
    'storeId', 'warehouse', 'shipment', 'status'
  ];
  for (const key of fields) {
    if (!(key in body)) continue;
    if ((key === 'warehouse' || key === 'shipment') && !body[key]) {
      existing[key] = undefined;
    } else {
      existing[key] = body[key];
    }
  }

  await existing.save();
  res.json({ ok: true, data: existing });
});

export const removeLoose = asyncHandler(async (req, res) => {
  const doc = await Item.findOne({ _id: req.params.id, business: req.businessId });
  if (!doc) throw new ApiError(404, 'Item not found');
  await assertWorkerItemAccess(req, doc);
  const userName = req.userDoc?.name || req.userDoc?.email || 'System';
  const qty = Math.max(Number(doc.qty) || 0, 1);
  await logItemActivity(doc, {
    type: 'outbound',
    qty,
    desc: `Deleted ${qty}× ${doc.name} from inventory`,
    source: 'Inventory',
    userName
  });
  await Item.deleteOne({ _id: doc._id });
  invalidateFinanceSync(req.businessId);
  res.json({ ok: true, message: 'Deleted' });
});

export const bulkDeleteLoose = asyncHandler(async (req, res) => {
  const ids = req.body.ids || [];
  if (!ids.length) throw new ApiError(400, 'No items selected');
  const items = await Item.find({ _id: { $in: ids }, business: req.businessId });
  for (const item of items) {
    await assertWorkerItemAccess(req, item);
  }
  const userName = req.userDoc?.name || req.userDoc?.email || 'System';
  for (const item of items) {
    const qty = Math.max(Number(item.qty) || 0, 1);
    await logItemActivity(item, {
      type: 'outbound',
      qty,
      desc: `Deleted ${qty}× ${item.name} from inventory`,
      source: 'Inventory',
      userName
    });
  }
  const result = await Item.deleteMany({ _id: { $in: ids }, business: req.businessId });
  invalidateFinanceSync(req.businessId);
  res.json({ ok: true, message: `Deleted ${result.deletedCount} item(s)`, deletedCount: result.deletedCount });
});

/** Apply the same field updates to many items (qty is never changed). */
export const bulkUpdateLoose = asyncHandler(async (req, res) => {
  const ids = req.body.ids || [];
  const updates = { ...(req.body.updates || {}) };
  if (!ids.length) throw new ApiError(400, 'No items selected');
  if (!updates || !Object.keys(updates).length) {
    throw new ApiError(400, 'No fields to update');
  }

  delete updates.qty;
  delete updates.business;
  delete updates._id;
  delete updates.id;
  // Purchase cost stays on Purchases → Finance; never bulk-edit from inventory.
  delete updates.purchasePrice;
  delete updates.purchaseValue;
  if ('group' in updates) updates.group = normalizeGroup(updates.group);
  if (updates.category) applyCategoryDefaults(updates);

  const items = await Item.find({ _id: { $in: ids }, business: req.businessId });
  if (!items.length) throw new ApiError(404, 'No matching items found');

  let updatedCount = 0;
  for (const existing of items) {
    await assertWorkerItemAccess(req, existing);
    const body = { ...updates };

    const onHand = Math.max(Number(existing.qty) || 0, 0);
    if (body.targetPrice != null) {
      const unitXaf = Math.round(Number(body.targetPrice) || 0);
      body.targetPrice = unitXaf;
      body.priceXaf = unitXaf;
      body.value = unitXaf * onHand;
    }

    if (body.location !== undefined) {
      await syncItemPlacementFromLocation(req.businessId, body, { existing: existing.toObject() });
    }

    if (isWarehouseWorkerRole(req.businessRole)) {
      await assertWorkerItemAccess(req, { ...existing.toObject(), ...body });
    }

    const fields = [
      'name', 'sku', 'category', 'group', 'reorder', 'location',
      'targetPrice', 'value', 'priceXaf',
      'supplierId', 'purchaseDate', 'notes', 'photos', 'icon', 'color',
      'storeId', 'warehouse', 'shipment', 'status'
    ];
    for (const key of fields) {
      if (!(key in body)) continue;
      if ((key === 'warehouse' || key === 'shipment') && !body[key]) {
        existing[key] = undefined;
      } else {
        existing[key] = body[key];
      }
    }
    await existing.save();
    updatedCount += 1;
  }

  res.json({
    ok: true,
    updatedCount,
    message: `Updated ${updatedCount} item${updatedCount !== 1 ? 's' : ''}`
  });
});

export const scanItem = asyncHandler(async (req, res) => {
  const raw = decodeURIComponent(req.params.code || '').trim();
  if (!raw) throw new ApiError(400, 'Code required');

  let code = raw;
  if (raw.includes('afritrade:item/')) {
    code = raw.split('afritrade:item/')[1]?.split(/[?#/]/)[0] || raw;
  } else if (raw.includes('afritrade:bale/')) {
    code = raw.split('afritrade:bale/')[1]?.split(/[?#/]/)[0] || raw;
  }

  const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const skuMatch = new RegExp(`^${escapeRegex(code)}$`, 'i');
  const objectId = isValidId(code) ? code : null;

  const itemQuery = {
    business: req.businessId,
    $or: [{ sku: skuMatch }, { itemId: skuMatch }]
  };
  if (objectId) itemQuery.$or.push({ _id: objectId });

  const candidates = await Item.find(itemQuery).limit(20).lean();
  let item = candidates[0] || null;
  if (candidates.length > 1) {
    const assignedStoreId = getAssignedStoreId(req.userDoc, req.businessId, req.businessRole);
    const whIds = getAssignedWarehouseIds(req.userDoc, req.businessId, req.businessRole);
    if (assignedStoreId) {
      const scoped = await filterItemsForClerk(candidates, req.businessId, assignedStoreId, req.businessRole);
      item = scoped[0] || null;
    } else if (whIds?.length) {
      const scoped = await filterItemsForWarehouseWorker(candidates, req.businessId, whIds, req.businessRole);
      item = scoped[0] || null;
    } else if (objectId) {
      item = candidates.find((row) => String(row._id) === String(objectId)) || candidates[0];
    }
  }
  if (item) {
    const assignedStoreId = getAssignedStoreId(req.userDoc, req.businessId, req.businessRole);
    const whIds = getAssignedWarehouseIds(req.userDoc, req.businessId, req.businessRole);
    if (req.businessRole === ROLES.STORE_CLERK && !assignedStoreId) {
      throw new ApiError(404, 'No product found for this QR code');
    }
    if (whIds !== null && !whIds.length) {
      throw new ApiError(404, 'No product found for this QR code');
    }
    if (assignedStoreId) {
      const scoped = await filterItemsForClerk([item], req.businessId, assignedStoreId, req.businessRole);
      if (!scoped.length) throw new ApiError(404, 'Item not available at your store');
    } else if (whIds?.length) {
      const scoped = await filterItemsForWarehouseWorker([item], req.businessId, whIds, req.businessRole);
      if (!scoped.length) throw new ApiError(404, 'Item not in your assigned warehouses');
    }
    return res.json({ ok: true, matchType: 'item', data: item });
  }

  throw new ApiError(404, 'No product found for this QR code');
});

export const inventoryStats = asyncHandler(async (req, res) => {
  const filter = looseFilter(req.businessId);
  const assignedStoreId = getAssignedStoreId(req.userDoc, req.businessId, req.businessRole);
  const whIds = await getEffectiveWarehouseIds(req);

  if (assignedStoreId) {
    let data = await Item.find(filter).limit(500).lean();
    data = await filterItemsForClerk(data, req.businessId, assignedStoreId, req.businessRole);
    return res.json({
      ok: true,
      itemCount: data.length,
      totalRecords: data.length,
      looseSkus: data.length,
      lowStock: 0,
      totalValue: 0
    });
  }

  if (req.businessRole === ROLES.STORE_CLERK) {
    return res.json({
      ok: true,
      itemCount: 0,
      totalRecords: 0,
      looseSkus: 0,
      lowStock: 0,
      totalValue: 0
    });
  }

  if (whIds !== null) {
    if (!whIds.length) {
      return res.json({
        ok: true,
        itemCount: 0,
        totalRecords: 0,
        looseSkus: 0,
        lowStock: 0,
        totalValue: 0
      });
    }
    const whScope = await buildWarehouseItemScopeFilter(req.businessId, whIds);
    const scopedFilter = { ...filter, $and: [...(filter.$and || []), whScope] };
    let data = await Item.find(scopedFilter).limit(500).lean();
    data = await filterItemsForWarehouseWorker(data, req.businessId, whIds, req.businessRole);
    return res.json({
      ok: true,
      itemCount: data.length,
      totalRecords: data.length,
      looseSkus: data.length,
      lowStock: 0,
      totalValue: 0
    });
  }

  const [looseCount, looseItems] = await Promise.all([
    Item.countDocuments(filter),
    Item.find(filter).select('targetPrice priceXaf qty').lean()
  ]);

  const totalValue = looseItems.reduce((s, it) => {
    const price = it.targetPrice ?? it.priceXaf ?? 0;
    return s + price * (it.qty || 0);
  }, 0);

  res.json({
    ok: true,
    itemCount: looseCount,
    totalRecords: looseCount,
    looseSkus: looseCount,
    lowStock: 0,
    totalValue
  });
});

export const listLocations = asyncHandler(async (req, res) => {
  const assignedStoreId = getAssignedStoreId(req.userDoc, req.businessId, req.businessRole);
  const whIds = await getEffectiveWarehouseIds(req);

  if (assignedStoreId) {
    const names = await clerkLocationNames(req.businessId, assignedStoreId);
    if (req.query.grouped === 'true') {
      return res.json({
        ok: true,
        groups: [{ label: 'Your store', items: names.map((name) => ({ name, type: 'store' })) }]
      });
    }
    return res.json({ ok: true, data: names });
  }

  if (whIds !== null) {
    const warehouses = await loadAssignedWarehouses(req.businessId, whIds);
    if (req.query.grouped === 'true') {
      return res.json({
        ok: true,
        groups: [
          {
            label: 'Your warehouses',
            items: warehouses.map((w) => ({
              id: String(w._id),
              name: warehouseDisplayName(w),
              type: 'warehouse'
            }))
          }
        ]
      });
    }
    return res.json({
      ok: true,
      data: warehouses.map((w) => warehouseDisplayName(w)).filter(Boolean)
    });
  }

  const warehouses = await Warehouse.find({ business: req.businessId }).select('name location _id');
  const storeDocs = await Store.find({ business: req.businessId, active: { $ne: false } })
    .select('name city locationToken storeId')
    .lean();
  const items = await Item.distinct('location', { business: req.businessId, location: { $ne: '' } });

  if (req.query.grouped === 'true') {
    const warehouseItems = warehouses.map((w) => ({
      id: w._id.toString(),
      name: w.name,
      type: 'warehouse'
    }));

    const storeLabelSet = new Set(storeDocs.map((s) => locationLabelForStore(s)));
    // Only canonical store labels — do not also add bare store.name (duplicates like
    // "Yaounde Store" + "Yaounde Store — Yaounde").
    items.forEach((n) => {
      const matched = storeDocs.find(
        (s) => n === locationLabelForStore(s) || n === String(s.name || '').trim()
      );
      if (matched) storeLabelSet.add(locationLabelForStore(matched));
    });
    const storeItems = [...storeLabelSet]
      .filter(Boolean)
      .sort()
      .map((name) => ({ name, type: 'store' }));

    const otherNames = new Set(['On Transit', 'Douala Port']);
    items.forEach((n) => {
      const isWarehouse = warehouseItems.some((w) => w.name === n);
      const isStore =
        storeLabelSet.has(n) ||
        storeDocs.some((s) => n === String(s.name || '').trim() || n === locationLabelForStore(s));
      if (!isWarehouse && !isStore) otherNames.add(n);
    });

    const groups = [
      { label: 'Warehouses', items: warehouseItems },
      { label: 'Stores', items: storeItems },
      {
        label: 'Other',
        items: [...otherNames].sort().map((name) => ({ name, type: 'other' }))
      }
    ];

    return res.json({ ok: true, groups });
  }

  const names = new Set();
  warehouses.forEach((w) => {
    if (w.name) names.add(w.name);
  });
  storeDocs.forEach((s) => {
    names.add(locationLabelForStore(s));
  });
  items.forEach((n) => {
    const matchedStore = storeDocs.find(
      (s) => n === locationLabelForStore(s) || n === String(s.name || '').trim()
    );
    if (matchedStore) {
      names.add(locationLabelForStore(matchedStore));
      return;
    }
    names.add(n);
  });
  res.json({ ok: true, data: [...names].sort() });
});

export const listSuppliersForPicker = asyncHandler(async (req, res) => {
  const data = await Supplier.find({ business: req.businessId }).sort({ name: 1 });
  res.json({ ok: true, data });
});

/** Legacy resource controllers */
export const itemCtrl = createResourceController(Item, {
  idField: 'sku',
  idPrefix: 'SKU',
  searchFields: ['name', 'sku', 'category'],
  beforeCreate: async (data, req) => {
    await enforceInventoryItemLimit(req.businessId, Item);
    data.createdBy = req.userDoc._id;
    applyCategoryDefaults(data);
    syncItemPricing(data);
  }
});

export const warehouseCtrl = createResourceController(Warehouse, {
  searchFields: ['name', 'location', 'code']
});

export const transferStock = asyncHandler(async (req, res) => {
  const { itemId, sku, qty, fromWarehouse, toWarehouse, fromBale, toBale, notes } = req.body;
  if (!qty || qty < 1) throw new ApiError(400, 'Invalid quantity');

  let item = itemId ? await Item.findOne({ _id: itemId, business: req.businessId }) : null;
  if (!item && sku) item = await Item.findOne({ sku, business: req.businessId });
  if (!item) throw new ApiError(404, 'Item not found');
  if (item.qty < qty) throw new ApiError(400, 'Insufficient stock');

  item.qty -= qty;
  if (toWarehouse) item.warehouse = toWarehouse;
  if (toBale) item.bale = toBale;
  await item.save();

  const { StockMovement } = await import('../models/Warehouse.js');
  const movement = await StockMovement.create({
    business: req.businessId,
    type: 'transfer',
    fromWarehouse,
    toWarehouse,
    fromBale,
    toBale,
    item: item._id,
    sku: item.sku,
    qty,
    notes,
    performedBy: req.userDoc._id
  });

  res.json({ ok: true, data: movement, item });
});

export const inventorySummary = asyncHandler(async (req, res) => {
  const filter = looseFilter(req.businessId);
  const whIds = await getEffectiveWarehouseIds(req);

  if (whIds !== null) {
    if (!whIds.length) {
      return res.json({ ok: true, totalQty: 0, totalValue: 0, lowStock: 0, itemCount: 0 });
    }
    const whScope = await buildWarehouseItemScopeFilter(req.businessId, whIds);
    filter.$and = [...(filter.$and || []), whScope];
    let items = await Item.find(filter).lean();
    items = await filterItemsForWarehouseWorker(items, req.businessId, whIds, req.businessRole);
    const totalQty = items.reduce((s, i) => s + i.qty, 0);
    const totalValue = items.reduce(
      (s, i) => s + (Number(i.targetPrice ?? i.priceXaf) || 0) * (Number(i.qty) || 0),
      0
    );
    return res.json({
      ok: true,
      totalQty,
      totalValue,
      lowStock: 0,
      itemCount: items.length
    });
  }

  const items = await Item.find(filter);
  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  const totalValue = items.reduce(
    (s, i) => s + (Number(i.targetPrice ?? i.priceXaf) || 0) * (Number(i.qty) || 0),
    0
  );
  res.json({
    ok: true,
    totalQty,
    totalValue,
    lowStock: 0,
    itemCount: items.length
  });
});
