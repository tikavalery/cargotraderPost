import { isValidId } from './ids.js';
import Item from '../models/Item.js';
import { syncItemPricing } from '../constants/inventory.js';
import { nextInventoryItemId } from './purchaseHelpers.js';
import { formatTransitLocationLabel } from './inventoryLocationHelpers.js';

/**
 * Normalize transfer payload to [{ id, qty }].
 * Accepts `items: [{ itemId|id, qty }]` and/or legacy `itemIds: []` (full qty).
 */
export function normalizeTransferLines(items = [], itemIds = []) {
  const lines = [];
  const seen = new Set();

  const push = (rawId, qtyRaw) => {
    const id = String(rawId ?? '').trim();
    if (!id || id === 'undefined' || id === 'null' || seen.has(id)) return;
    seen.add(id);
    const qty = Number(qtyRaw);
    lines.push({
      id,
      qty: Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : null
    });
  };

  for (const raw of Array.isArray(items) ? items : []) {
    if (raw == null) continue;
    if (typeof raw === 'string' || typeof raw === 'number') {
      push(raw, null);
      continue;
    }
    push(raw.itemId || raw.id || raw._id || raw.selectId, raw.qty);
  }

  for (const rawId of Array.isArray(itemIds) ? itemIds : []) {
    push(rawId, null);
  }

  return lines;
}

/** Build a safe $or id matcher (avoids CastError when id is not an ObjectId). */
export function itemIdMatchClause(id) {
  const clauses = [{ itemId: id }, { sku: id }];
  if (isValidId(id)) {
    clauses.unshift({ _id: id });
  }
  return { $or: clauses };
}

export function applyItemPricing(item) {
  syncItemPricing(item);
  return item;
}

/** Mongo filter for an existing stock row of the same SKU at the destination (for merge). */
export function destinationSkuFilter(businessId, sku, { toWh, toStore, toShipment, destinationType }) {
  const base = {
    business: businessId,
    sku,
    status: { $nin: ['Sold', 'Returned'] }
  };

  if (destinationType === 'store' && toStore) {
    return {
      ...base,
      storeId: String(toStore.storeId),
      $or: [{ warehouse: { $exists: false } }, { warehouse: null }]
    };
  }

  if (destinationType === 'shipment' && toShipment) {
    return {
      ...base,
      shipment: toShipment._id
    };
  }

  if (toWh) {
    return {
      ...base,
      warehouse: toWh._id,
      $and: [
        { $or: [{ storeId: { $exists: false } }, { storeId: null }, { storeId: '' }] },
        { $or: [{ shipment: { $exists: false } }, { shipment: null }] }
      ]
    };
  }

  return null;
}

export function applyDestinationPlacement(item, { destinationType, toWh, toStore, toShipment, toLocation }) {
  item.location = toLocation;
  if (destinationType === 'store') {
    item.storeId = String(toStore.storeId);
    item.status = 'In Store';
    item.warehouse = undefined;
    item.shipment = undefined;
  } else if (destinationType === 'shipment') {
    item.shipment = toShipment._id;
    item.warehouse = undefined;
    item.storeId = '';
    item.status = 'On Ship';
    item.location = formatTransitLocationLabel(toShipment);
  } else if (toWh) {
    item.warehouse = toWh._id;
    item.storeId = '';
    item.shipment = undefined;
    item.status = 'Stored';
  }
  return item;
}

/**
 * Move `moveQty` units of `source` to the destination.
 * Partial → decrement source and merge into / create destination row (same SKU).
 * Full qty → relocate the document, or merge into an existing destination row then remove source.
 */
export async function transferItemQuantity(source, moveQty, destCtx, session) {
  const available = Math.max(0, Number(source.qty) || 0);
  if (!available || moveQty <= 0) return 0;
  const qty = Math.min(moveQty, available);
  const isFullMove = qty === available;

  const destFilter = destinationSkuFilter(source.business, source.sku, destCtx);
  let dest = destFilter
    ? await Item.findOne({
        ...destFilter,
        _id: { $ne: source._id }
      }).session(session)
    : null;

  if (dest) {
    dest.qty = (dest.qty || 0) + qty;
    applyDestinationPlacement(dest, destCtx);
    applyItemPricing(dest);
    await dest.save({ session });

    if (isFullMove) {
      await Item.deleteOne({ _id: source._id }).session(session);
    } else {
      source.qty = available - qty;
      applyItemPricing(source);
      await source.save({ session });
    }
    return qty;
  }

  if (isFullMove) {
    applyDestinationPlacement(source, destCtx);
    applyItemPricing(source);
    await source.save({ session });
    return qty;
  }

  const clone = source.toObject();
  delete clone._id;
  delete clone.__v;
  delete clone.createdAt;
  delete clone.updatedAt;
  // Keep purchase cost lineage for finance (avoid double COGS) without making this
  // row the primary purchase↔inventory sync target.
  const lineagePurchaseId =
    source.purchaseId || source.sourcedFromPurchaseId || clone.sourcedFromPurchaseId || '';
  delete clone.purchaseId;
  delete clone.purchase;
  clone.sourcedFromPurchaseId = lineagePurchaseId || '';
  clone.qty = qty;
  clone.itemId = await nextInventoryItemId(source.business);
  applyDestinationPlacement(clone, destCtx);
  applyItemPricing(clone);

  const created = new Item(clone);
  created.$locals = { skipPlanLimit: true };
  await created.save({ session });

  source.qty = available - qty;
  applyItemPricing(source);
  await source.save({ session });
  return qty;
}
