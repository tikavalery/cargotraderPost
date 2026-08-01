import { isValidId } from '../utils/ids.js';
import Item from '../models/Item.js';
import Shipment from '../models/Shipment.js';
import {
  Warehouse,
  WarehouseStaff,
  WarehouseLog,
  WarehouseDamage,
  StockMovement
} from '../models/Warehouse.js';
import ApiError, { asyncHandler } from '../utils/ApiError.js';
import { enforceInventoryItemLimit } from '../utils/inventoryPlanEnforcement.js';
import { createNoopSession } from '../utils/noopSession.js';
import {
  computeUtilization,
  flagForCountry,
  formatStockItem,
  formatWarehouseCard,
  formatWarehouseListCard,
  formatWarehouseSummary,
  getWarehouseStockCounts,
  timeAgo,
  warehouseMatchFilter,
  warehouseItemFilter
} from '../utils/warehouseHelpers.js';
import { categoryMeta } from '../constants/inventory.js';
import { ensureCloudPhotos } from '../utils/ensureCloudPhotos.js';
import { findStore } from '../utils/storeHelpers.js';
import { StoreLog } from '../models/Store.js';
import { locationLabelForStore, storeItemFilter, itemBelongsToStore, loadStore } from '../utils/posHelpers.js';
import { assertClerkStoreAccess } from '../utils/clerkScope.js';
import { invalidateFinanceSync } from '../services/financeSync.service.js';
import { shipmentByIdFilter } from '../utils/shipmentHelpers.js';
import { formatTransitLocationLabel, syncShipmentItemCount } from '../utils/inventoryLocationHelpers.js';
import {
  normalizeTransferLines,
  transferItemQuantity,
  itemIdMatchClause
} from '../utils/transferHelpers.js';
import {
  getAssignedWarehouseIds,
  assertWarehouseAccess,
  canAccessAllWarehouses
} from '../utils/warehouseScope.js';

function whFilter(businessId, id) {
  const clauses = [{ warehouseId: id }];
  if (isValidId(id)) clauses.push({ _id: id });
  return { business: businessId, $or: clauses };
}

async function findWarehouse(businessId, id) {
  const doc = await Warehouse.findOne(whFilter(businessId, id));
  if (!doc) throw new ApiError(404, 'Warehouse not found');
  return doc;
}

async function findWarehouseScoped(req, id) {
  const wh = await findWarehouse(req.businessId, id);
  assertWarehouseAccess(req, wh);
  return wh;
}

export const listWarehouses = asyncHandler(async (req, res) => {
  let docs = await Warehouse.find({ business: req.businessId }).sort({ name: 1 });
  const whIds = getAssignedWarehouseIds(req.userDoc, req.businessId, req.businessRole);
  if (whIds !== null) {
    if (!whIds.length) docs = [];
    else {
      const allowed = new Set(whIds);
      docs = docs.filter((wh) => allowed.has(String(wh._id)) || allowed.has(wh.warehouseId));
    }
  }
  const warehouses = [];
  const countries = new Set();

  for (const wh of docs) {
    countries.add(wh.country);
    warehouses.push(formatWarehouseListCard(wh));
  }

  res.json({
    ok: true,
    warehouses,
    meta: {
      locationCount: warehouses.length,
      countryCount: countries.size
    }
  });
});

export const getWarehouse = asyncHandler(async (req, res) => {
  const wh = await findWarehouseScoped(req, req.params.warehouseId);
  const [stats, staff] = await Promise.all([
    getWarehouseStockCounts(req.businessId, wh),
    WarehouseStaff.find({ business: req.businessId, warehouse: wh._id })
  ]);
  res.json({ ok: true, data: formatWarehouseCard(wh, stats, staff) });
});

export const createWarehouse = asyncHandler(async (req, res) => {
  if (!canAccessAllWarehouses(req.businessRole)) {
    throw new ApiError(403, 'Only business owners can create warehouses');
  }
  const name = (req.body.name || '').trim();
  if (!name) throw new ApiError(400, 'Warehouse name is required');

  const country = req.body.country || 'Cameroon';
  const warehouseId = req.body.warehouseId || `wh-${Date.now()}`;

  const doc = await Warehouse.create({
    business: req.businessId,
    warehouseId,
    name,
    flag: flagForCountry(country),
    address: (req.body.address || '').trim(),
    location: (req.body.address || '').split(',')[1]?.trim() || country,
    country,
    status: 'Operational',
    capacityM3: Math.max(Number(req.body.capacityM3) || 200, 50),
    manager: (req.body.manager || '').trim(),
    phone: (req.body.phone || '').trim()
  });

  const card = formatWarehouseCard(doc, { itemsCount: 0, valueUsd: 0 }, []);
  res.status(201).json({ ok: true, data: card });
});

export const updateWarehouse = asyncHandler(async (req, res) => {
  if (!canAccessAllWarehouses(req.businessRole)) {
    throw new ApiError(403, 'Only business owners can edit warehouse settings');
  }
  const wh = await findWarehouseScoped(req, req.params.warehouseId);
  const fields = ['name', 'address', 'manager', 'phone', 'capacityM3', 'status'];
  fields.forEach((f) => {
    if (req.body[f] != null) wh[f] = req.body[f];
  });
  if (req.body.capacityM3 != null) wh.capacityM3 = Math.max(Number(req.body.capacityM3), 50);
  await wh.save();

  const [stats, staff] = await Promise.all([
    getWarehouseStockCounts(req.businessId, wh),
    WarehouseStaff.find({ business: req.businessId, warehouse: wh._id })
  ]);
  res.json({ ok: true, data: formatWarehouseCard(wh, stats, staff) });
});

export const deleteWarehouse = asyncHandler(async (req, res) => {
  if (!canAccessAllWarehouses(req.businessRole)) {
    throw new ApiError(403, 'Only business owners can delete warehouses');
  }
  const wh = await findWarehouseScoped(req, req.params.warehouseId);
  const match = warehouseMatchFilter(wh);
  await Promise.all([
    Item.deleteMany({ business: req.businessId, ...match }),
    WarehouseStaff.deleteMany({ warehouse: wh._id }),
    WarehouseLog.deleteMany({ warehouse: wh._id }),
    WarehouseDamage.deleteMany({ warehouse: wh._id }),
    Warehouse.deleteOne({ _id: wh._id })
  ]);
  invalidateFinanceSync(req.businessId);
  res.json({ ok: true, message: 'Deleted' });
});

export const getStock = asyncHandler(async (req, res) => {
  const wh = await findWarehouseScoped(req, req.params.warehouseId);
  const filter = { business: req.businessId, ...warehouseItemFilter(wh) };
  if (req.query.category) filter.category = String(req.query.category);
  const search = String(req.query.search || '').trim();
  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: regex }, { sku: regex }, { itemId: regex }];
  }

  const wantsPage = req.query.page != null || req.query.limit != null || req.query.pageSize != null;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || req.query.pageSize, 10) || 25));
  const skip = (page - 1) * limit;

  if (!wantsPage) {
    const items = await Item.find(filter).sort({ name: 1 });
    return res.json({ ok: true, data: items.map(formatStockItem) });
  }

  const [total, items] = await Promise.all([
    Item.countDocuments(filter),
    Item.find(filter).sort({ name: 1 }).skip(skip).limit(limit)
  ]);

  res.json({
    ok: true,
    data: items.map(formatStockItem),
    pagination: {
      page,
      pageSize: limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit))
    }
  });
});

export const addStock = asyncHandler(async (req, res) => {
  await enforceInventoryItemLimit(req.businessId, Item);
  const wh = await findWarehouseScoped(req, req.params.warehouseId);
  const meta = categoryMeta(req.body.category || 'Clothes');
  const qty = Math.max(Number(req.body.qty) || 1, 1);
  const purchasePrice = Number(req.body.purchasePrice) || 0;
  const targetPrice = Number(req.body.targetPrice) || 0;
  const photos = await ensureCloudPhotos(req.body.photos || [], { businessId: req.businessId });
  const doc = await Item.saveNew({
    business: req.businessId,
    warehouse: wh._id,
    location: req.body.location || wh.name,
    name: req.body.name,
    sku: req.body.sku || `SKU-${Date.now()}`,
    category: req.body.category || 'Clothes',
    qty,
    reorder: Number(req.body.reorder) || 5,
    purchasePrice,
    targetPrice,
    purchaseValue: purchasePrice * qty,
    value: targetPrice * qty,
    priceXaf: targetPrice,
    photos,
    icon: meta.icon,
    color: meta.color,
    notes: req.body.notes || '',
    createdBy: req.userDoc._id
  });
  if (purchasePrice > 0) invalidateFinanceSync(req.businessId);
  res.status(201).json({ ok: true, data: formatStockItem(doc) });
});

export const updateStock = asyncHandler(async (req, res) => {
  const wh = await findWarehouseScoped(req, req.params.warehouseId);
  const existing = await Item.findOne({
    business: req.businessId,
    _id: req.params.itemId,
    ...warehouseMatchFilter(wh)
  });
  if (!existing) throw new ApiError(404, 'Item not found');

  const body = { ...req.body };
  // Qty must not change via edit — use transfers, sales, returns, or write-offs.
  delete body.qty;
  delete body.business;
  // Purchase cost is owned by Purchases → Finance; do not change from warehouse stock edit.
  delete body.purchasePrice;
  delete body.purchaseValue;

  const onHand = Math.max(Number(existing.qty) || 0, 1);
  if (body.targetPrice != null) {
    body.value = Number(body.targetPrice) * onHand;
    body.priceXaf = Number(body.targetPrice);
  }

  if (body.photos) {
    body.photos = await ensureCloudPhotos(body.photos, { businessId: req.businessId });
  }

  Object.assign(existing, body);
  await existing.save();
  res.json({ ok: true, data: formatStockItem(existing) });
});

export const deleteStock = asyncHandler(async (req, res) => {
  const wh = await findWarehouseScoped(req, req.params.warehouseId);
  const doc = await Item.findOneAndDelete({
    business: req.businessId,
    _id: req.params.itemId,
    ...warehouseMatchFilter(wh)
  });
  if (!doc) throw new ApiError(404, 'Item not found');
  invalidateFinanceSync(req.businessId);
  res.json({ ok: true, message: 'Deleted' });
});

export const getLogs = asyncHandler(async (req, res) => {
  const wh = await findWarehouseScoped(req, req.params.warehouseId);
  const logs = await WarehouseLog.find({
    business: req.businessId,
    warehouse: wh._id,
    // Exclude in-transit / shipment movement rows (no real warehouse stock event)
    locationKind: { $ne: 'shipment' }
  })
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

export const transferStock = asyncHandler(async (req, res) => {
  const {
    sourceType = 'warehouse',
    fromWarehouseId,
    fromStoreId,
    fromShipmentId,
    toDestinationId,
    destinationType = 'warehouse',
    items = [],
    itemIds = [],
    notes = ''
  } = req.body;

  const transferLines = normalizeTransferLines(items, itemIds);
  if (!transferLines.length) throw new ApiError(400, 'No items selected');

  let fromWh = null;
  let fromStore = null;
  let fromShipment = null;

  if (sourceType === 'store') {
    if (!fromStoreId) throw new ApiError(400, 'Source store is required');
    assertClerkStoreAccess(req, fromStoreId);
    fromStore = await findStore(req.businessId, fromStoreId);
  } else if (sourceType === 'shipment') {
    if (!fromShipmentId) throw new ApiError(400, 'Source shipment is required');
    fromShipment = await Shipment.findOne(shipmentByIdFilter(req.businessId, fromShipmentId));
    if (!fromShipment) throw new ApiError(404, 'Source shipment not found');
  } else {
    if (!fromWarehouseId) throw new ApiError(400, 'Source warehouse is required');
    fromWh = await findWarehouseScoped(req, fromWarehouseId);
  }

  let toWh = null;
  let toStore = null;
  let toShipment = null;
  let toLocation = toDestinationId;

  if (destinationType === 'warehouse') {
    toWh = await findWarehouseScoped(req, toDestinationId);
    toLocation = toWh.name;
  } else if (destinationType === 'store') {
    if (sourceType !== 'store' && !canAccessAllWarehouses(req.businessRole)) {
      throw new ApiError(403, 'Warehouse workers cannot transfer stock to stores');
    }
    toStore = await findStore(req.businessId, toDestinationId);
    if (fromStore && String(fromStore.storeId) === String(toStore.storeId)) {
      throw new ApiError(400, 'Cannot transfer items to the same store');
    }
    toLocation = locationLabelForStore(toStore);
  } else if (destinationType === 'shipment') {
    toShipment = await Shipment.findOne({
      ...shipmentByIdFilter(req.businessId, toDestinationId),
      mode: 'active'
    });
    if (!toShipment) throw new ApiError(404, 'Active shipment not found');
    if (fromShipment && String(fromShipment._id) === String(toShipment._id)) {
      throw new ApiError(400, 'Cannot transfer items to the same shipment');
    }
    toLocation = formatTransitLocationLabel(toShipment);
  } else {
    throw new ApiError(400, 'Invalid destination type');
  }

  const userName = req.userDoc?.name || req.userDoc?.email || 'System';
  const sourceLabel = fromShipment ? fromShipment.shipmentId : fromStore ? fromStore.name : fromWh.name;
  let movedUnits = 0;
  let movedLines = 0;

  const destCtx = { destinationType, toWh, toStore, toShipment, toLocation };

  const session = createNoopSession();
  session.startTransaction();
  try {
    for (const line of transferLines) {
      const idClause = itemIdMatchClause(line.id);
      let item = null;

      if (fromShipment) {
        item = await Item.findOne({
          business: req.businessId,
          shipment: fromShipment._id,
          ...idClause
        }).session(session);
      } else if (fromStore) {
        // Prefer tagged shelf stock, then fall back to legacy location-matched rows
        // (same rules as getStoreInventoryItems) so transfers don't miss visible items.
        item = await Item.findOne({
          business: req.businessId,
          $and: [storeItemFilter(fromStore.storeId), idClause]
        }).session(session);

        if (!item) {
          const candidates = await Item.find({
            business: req.businessId,
            status: 'In Store',
            qty: { $gt: 0 },
            $and: [
              idClause,
              { $or: [{ warehouse: { $exists: false } }, { warehouse: null }] },
              { $or: [{ storeId: { $exists: false } }, { storeId: null }, { storeId: '' }] }
            ]
          }).session(session);
          const storeDoc = await loadStore(req.businessId, fromStore.storeId);
          item =
            candidates.find((row) => itemBelongsToStore(row, fromStore.storeId, storeDoc || fromStore)) ||
            null;
        }
      } else {
        const scopeClause = warehouseItemFilter(fromWh);
        const scopeParts = scopeClause.$and ? scopeClause.$and : [scopeClause];
        item = await Item.findOne({
          business: req.businessId,
          $and: [idClause, ...scopeParts]
        }).session(session);
      }

      if (!item) continue;

      const available = Math.max(0, Number(item.qty) || 0);
      if (!available) continue;

      const requested = line.qty == null ? available : line.qty;
      if (requested <= 0) continue;
      if (requested > available) {
        throw new ApiError(
          400,
          `Cannot transfer ${requested} of "${item.name}" — only ${available} available`
        );
      }

      const movedQty = await transferItemQuantity(item, requested, destCtx, session);
      if (!movedQty) continue;

      movedUnits += movedQty;
      movedLines += 1;
      const destLabel = toStore
        ? toStore.name
        : toShipment
          ? toShipment.shipmentId
          : toLocation;

      if (fromWh) {
        await WarehouseLog.create(
          [
            {
              business: req.businessId,
              warehouse: fromWh._id,
              type: 'outbound',
              desc: `Transferred ${movedQty}× ${item.name} to ${destLabel}`,
              date: new Date().toISOString().slice(0, 10),
              user: userName,
              source: 'Transfer',
              qty: movedQty,
              ago: 'just now'
            }
          ],
          { session }
        );
      }
      if (toWh) {
        await WarehouseLog.create(
          [
            {
              business: req.businessId,
              warehouse: toWh._id,
              type: 'inbound',
              desc: `Received ${movedQty}× ${item.name} from ${sourceLabel}`,
              date: new Date().toISOString().slice(0, 10),
              user: userName,
              source: fromStore ? 'Store Return' : fromShipment ? 'Shipment' : 'Transfer',
              qty: movedQty,
              ago: 'just now'
            }
          ],
          { session }
        );
      }
      if (fromStore) {
        await StoreLog.create(
          [
            {
              business: req.businessId,
              store: fromStore._id,
              storeId: fromStore.storeId,
              type: 'outbound',
              desc: `Transferred ${movedQty}× ${item.name} to ${destLabel}`,
              date: new Date().toISOString().slice(0, 10),
              user: userName,
              source: toStore ? 'Store Transfer' : toShipment ? 'Shipment' : 'Transfer',
              qty: movedQty,
              ago: 'just now'
            }
          ],
          { session }
        );
      }
      if (toStore) {
        await StoreLog.create(
          [
            {
              business: req.businessId,
              store: toStore._id,
              storeId: toStore.storeId,
              type: 'inbound',
              desc: `Received ${movedQty}× ${item.name} from ${sourceLabel}`,
              date: new Date().toISOString().slice(0, 10),
              user: userName,
              source: fromWh ? 'Warehouse Transfer' : fromStore ? 'Store Transfer' : fromShipment ? 'Shipment' : 'Transfer',
              qty: movedQty,
              ago: 'just now'
            }
          ],
          { session }
        );
      }
    }

    if (!movedUnits) {
      throw new ApiError(
        400,
        fromStore
          ? 'No matching store shelf items found for transfer. Refresh the page and try again.'
          : 'Nothing to transfer'
      );
    }

    if (fromShipment) {
      await syncShipmentItemCount(req.businessId, fromShipment._id, { session });
    }
    if (toShipment) {
      await syncShipmentItemCount(req.businessId, toShipment._id, { session });
    }

    await StockMovement.create(
      [
        {
          business: req.businessId,
          type: 'transfer',
          fromWarehouse: fromWh?._id,
          toWarehouse: toWh?._id,
          qty: movedUnits,
          notes:
            fromStore && toStore
              ? `${notes ? `${notes} · ` : ''}Store: ${fromStore.name} → Store: ${toStore.name}`
              : fromStore && toWh
              ? `${notes ? `${notes} · ` : ''}Store: ${fromStore.name} → Warehouse: ${toWh.name}`
              : fromShipment && toShipment
                ? `${notes ? `${notes} · ` : ''}${fromShipment.shipmentId} → ${toShipment.shipmentId}`
                : fromShipment && toStore
                  ? `${notes ? `${notes} · ` : ''}From ${fromShipment.shipmentId} · Store: ${toStore.name}`
                  : fromShipment && toWh
                    ? `${notes ? `${notes} · ` : ''}From ${fromShipment.shipmentId} · Warehouse: ${toWh.name}`
                    : toShipment
                      ? `${notes ? `${notes} · ` : ''}Shipment: ${toShipment.shipmentId}`
                      : toStore
                        ? `${notes ? `${notes} · ` : ''}Store: ${toStore.name}`
                        : notes,
          performedBy: req.userDoc._id
        }
      ],
      { session }
    );

    await session.commitTransaction();

    const unitLabel = `${movedUnits} unit${movedUnits !== 1 ? 's' : ''}`;
    const lineHint = movedLines !== movedUnits ? ` across ${movedLines} product${movedLines !== 1 ? 's' : ''}` : '';

    res.json({
      ok: true,
      movedItems: movedUnits,
      movedUnits,
      movedLines,
      destinationType,
      toLocation,
      message:
        fromStore && destinationType === 'store'
          ? `${unitLabel}${lineHint} moved from ${fromStore.name} to ${toStore.name}. Items are now available in the destination store POS.`
          : fromStore && destinationType === 'warehouse'
          ? `${unitLabel}${lineHint} returned to ${toWh.name} from ${fromStore.name}.`
          : fromStore && destinationType === 'shipment'
            ? `${unitLabel}${lineHint} loaded onto ${toShipment.shipmentId} from ${fromStore.name}.`
            : destinationType === 'store'
              ? `${unitLabel}${lineHint} sent to ${toStore.name}. Items are now available in POS and inventory scan.`
              : destinationType === 'shipment'
                ? `${unitLabel}${lineHint} loaded onto ${toShipment.shipmentId}. View them under Shipping → Individual Items.`
                : fromShipment
                  ? `${unitLabel}${lineHint} moved from ${fromShipment.shipmentId} to ${toWh.name}.`
                  : `Transfer completed successfully! ${unitLabel}${lineHint} moved.`
    });
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
});

export const getKpis = asyncHandler(async (req, res) => {
  let docs = await Warehouse.find({ business: req.businessId });
  const whIds = getAssignedWarehouseIds(req.userDoc, req.businessId, req.businessRole);
  if (whIds !== null) {
    if (!whIds.length) docs = [];
    else {
      const allowed = new Set(whIds);
      docs = docs.filter((wh) => allowed.has(String(wh._id)) || allowed.has(wh.warehouseId));
    }
  }
  const countries = new Set(docs.map((d) => d.country));
  res.json({ ok: true, locationCount: docs.length, countryCount: countries.size });
});
