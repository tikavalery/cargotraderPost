import { Purchase, Supplier } from '../models/Purchase.js';
import Item from '../models/Item.js';
import { categoryMeta, syncItemPricing } from '../constants/inventory.js';
import { enforceInventoryItemLimit } from './inventoryPlanEnforcement.js';
import { attachWarehouseFromLocation } from './warehouseHelpers.js';
import {
  isTransitLocation,
  formatTransitLocationLabel,
  resolveShipmentForTransitItem,
  syncItemPlacementFromLocation
} from './inventoryLocationHelpers.js';
import { logInventoryActivity } from './inventoryActivityLog.js';
import Shipment from '../models/Shipment.js';

const SHIP_LOCATIONS = new Set(['On Transit', 'Douala Port']);

export function computeStockStatus(location) {
  const loc = String(location || '').trim();
  if (SHIP_LOCATIONS.has(loc) || /^on transit\b/i.test(loc) || /transit/i.test(loc)) {
    return 'On Ship';
  }
  return 'Stored';
}

function normalizeGroup(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

export function normalizePurchaseBody(body, existing = null) {
  const quantityRaw =
    body.quantity != null && body.quantity !== ''
      ? Number(body.quantity)
      : existing?.quantity;
  const quantity = Math.max(Number(quantityRaw) || 0, body.status === 'draft' ? 0 : 1);
  const purchasePrice = Number(body.purchasePrice) || 0;
  const targetPrice = Number(body.targetPrice) || 0;
  const location = body.location || existing?.location || '';

  const data = {
    status: body.status === 'saved' ? 'saved' : 'draft',
    itemName: (body.itemName || '').trim(),
    sku: (body.sku || '').trim(),
    category: body.category || 'Clothes',
    group: 'group' in body ? normalizeGroup(body.group) : existing?.group ?? null,
    quantity,
    reorder: body.reorder != null && body.reorder !== '' ? Number(body.reorder) : 5,
    location,
    stockStatus: computeStockStatus(location),
    purchasePrice,
    purchaseValue: purchasePrice * Math.max(quantity, 1),
    targetPrice,
    value: targetPrice * Math.max(quantity, 1),
    notes: (body.notes || '').slice(0, 500),
    photos: Array.isArray(body.photos) ? body.photos.slice(0, 12) : []
  };

  if (body.purchaseDate) {
    data.purchaseDate = new Date(body.purchaseDate);
  } else if (existing?.purchaseDate) {
    data.purchaseDate = existing.purchaseDate;
  }

  if (body.supplierId) {
    data.supplierRef = body.supplierId;
  } else if (body.supplier) {
    data.supplierRef = body.supplier;
  }

  return data;
}

export function autoSku(category, purchaseId, sku) {
  if (sku && sku.trim()) return sku.trim();
  const prefix = (category || 'Clothes').slice(0, 3).toUpperCase();
  const num = String(purchaseId || '').replace(/^PUR-/, '');
  return `${prefix}-${num}`;
}

export async function nextPurchaseId(businessId) {
  const count = await Purchase.countDocuments({ business: businessId });
  const seq = String(count + 1).padStart(3, '0');
  return `PUR-${seq}`;
}

export async function nextSupplierId(businessId) {
  const count = await Supplier.countDocuments({ business: businessId });
  const seq = String(count + 1).padStart(3, '0');
  return `SUP-${seq}`;
}

export async function nextInventoryItemId(businessId) {
  const count = await Item.countDocuments({ business: businessId });
  return `ITM-${String(count + 1).padStart(3, '0')}`;
}

async function resolveInventorySku(businessId, purchase) {
  let sku = (purchase.sku || '').trim();
  if (!sku) sku = autoSku(purchase.category, purchase.purchaseId, '');
  const purchaseId = purchase.purchaseId;

  const conflict = await Item.findOne({
    business: businessId,
    sku,
    purchaseId: { $ne: purchaseId }
  }).select('_id');

  if (!conflict) return sku;

  const suffix = String(purchaseId).replace(/^PUR-/, '');
  const alt = `${sku}-${suffix}`;
  const altConflict = await Item.findOne({
    business: businessId,
    sku: alt,
    purchaseId: { $ne: purchaseId }
  }).select('_id');

  return altConflict ? `${sku}-${suffix}-${Date.now().toString().slice(-4)}` : alt;
}

async function resolveInventoryItemId(businessId, purchase, existingItem) {
  if (existingItem?.itemId) return existingItem.itemId;

  const preferred = `ITM-${String(purchase.purchaseId).replace(/^PUR-/, '')}`;
  const idConflict = await Item.findOne({
    business: businessId,
    itemId: preferred,
    purchaseId: { $ne: purchase.purchaseId }
  }).select('_id');

  return idConflict ? nextInventoryItemId(businessId) : preferred;
}

export async function resolveSupplier(businessId, supplierRef) {
  if (!supplierRef) return null;
  const byCustom = await Supplier.findOne({ business: businessId, supplierId: supplierRef });
  if (byCustom) return byCustom;
  try {
    return await Supplier.findOne({ business: businessId, _id: supplierRef });
  } catch {
    return null;
  }
}

export function formatSupplierRecord(doc, stats = {}) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    ...o,
    id: o.supplierId,
    purchaseCount: stats.purchaseCount ?? o.purchaseCount ?? 0,
    totalPurchaseValue: stats.totalPurchaseValue ?? o.totalPurchaseValue ?? 0
  };
}

export function formatPurchaseDoc(doc, supplierDoc = null) {
  const o = doc.toObject ? doc.toObject() : { ...doc };
  const sup = supplierDoc || o.supplier;
  return {
    ...o,
    supplierId: sup?.supplierId || (typeof sup === 'object' && sup?._id ? sup.supplierId : null),
    supplierName: sup?.name || null,
    supplierCity: sup?.city || null,
    supplierCountry: sup?.country || null
  };
}

export function normalizePurchaseRecord(doc, supplierDoc = null) {
  const raw = formatPurchaseDoc(doc, supplierDoc);
  const qty = Math.max(Number(raw.quantity) || 0, 1);
  let purchasePrice = parseInt(raw.purchasePrice, 10) || 0;
  let purchaseValue = parseInt(raw.purchaseValue, 10) || purchasePrice * qty;
  let targetPrice = parseInt(raw.targetPrice, 10) || 0;
  let value = parseInt(raw.value, 10) || targetPrice * qty;

  if (!purchasePrice && purchaseValue && qty) purchasePrice = Math.round(purchaseValue / qty);
  if (!targetPrice && value && qty) targetPrice = Math.round(value / qty);

  const purchaseId = raw.purchaseId || raw.id;
  const sup = supplierDoc || raw.supplier;

  let purchaseDate = '';
  if (raw.purchaseDate) {
    purchaseDate = new Date(raw.purchaseDate).toISOString().slice(0, 10);
  }

  return {
    id: purchaseId,
    purchaseId,
    status: raw.status || 'draft',
    itemName: raw.itemName || '',
    sku: raw.sku || '',
    category: raw.category || 'Clothes',
    group: raw.group || null,
    quantity: qty,
    reorder: raw.reorder ?? 5,
    location: raw.location || '',
    stockStatus: raw.stockStatus || 'Stored',
    purchasePrice,
    purchaseValue,
    targetPrice,
    value,
    purchaseDate,
    notes: raw.notes || '',
    photos: raw.photos || [],
    supplierId: sup?.supplierId || raw.supplierId || null,
    supplier: sup
      ? {
          supplierId: sup.supplierId,
          name: sup.name,
          city: sup.city,
          country: sup.country,
          email: sup.email
        }
      : null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    isRestock: Boolean(raw.restockOf),
    restockOf: raw.restockOf ? String(raw.restockOf._id || raw.restockOf) : null
  };
}

/**
 * Units already removed from the linked inventory row (sold, transferred, etc.).
 * purchaseQty - onHand, floored at 0.
 */
export function unitsGoneFromPurchase(purchaseQty, onHandQty) {
  const purchased = Math.max(Number(purchaseQty) || 0, 0);
  const onHand = Math.max(Number(onHandQty) || 0, 0);
  return Math.max(0, purchased - onHand);
}

/**
 * Validate a purchase quantity change against stock already moved.
 * @returns {{ unitsGone: number, onHand: number, nextOnHand: number }}
 */
export async function assertPurchaseQuantityEditable(businessId, purchaseId, previousQty, nextQty) {
  const previous = Math.max(Number(previousQty) || 0, 0);
  const next = Math.max(Number(nextQty) || 0, 0);
  const item = await Item.findOne({ business: businessId, purchaseId }).select('qty').lean();
  if (!item) {
    return { unitsGone: 0, onHand: 0, nextOnHand: next };
  }
  const onHand = Math.max(Number(item.qty) || 0, 0);
  const unitsGone = unitsGoneFromPurchase(previous, onHand);
  if (next < unitsGone) {
    const err = new Error(
      `Cannot set quantity to ${next}. At least ${unitsGone} unit(s) have already left stock (sold or transferred). Minimum quantity is ${unitsGone}.`
    );
    err.statusCode = 400;
    throw err;
  }
  const nextOnHand = Math.max(0, onHand + (next - previous));
  return { unitsGone, onHand, nextOnHand };
}

/** Write inbound/outbound log for purchase stock changes. */
export async function logPurchaseStockMovement(
  purchase,
  { qtyDelta, userName = 'System', action = 'edit' } = {}
) {
  const delta = Number(qtyDelta) || 0;
  if (!delta) return;

  const itemName = purchase.itemName || 'Item';
  const absQty = Math.abs(delta);
  const type = delta > 0 ? 'inbound' : 'outbound';
  const pid = purchase.purchaseId ? ` (${purchase.purchaseId})` : '';
  const date = purchase.purchaseDate
    ? new Date(purchase.purchaseDate).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  let desc;
  if (action === 'delete' || action === 'remove') {
    desc = `Removed ${absQty}× ${itemName} — purchase deleted${pid}`;
  } else if (type === 'inbound') {
    if (action === 'restock') desc = `Restocked ${absQty}× ${itemName} from purchase${pid}`;
    else if (action === 'edit') desc = `Increased ${absQty}× ${itemName} from purchase edit${pid}`;
    else desc = `Received ${absQty}× ${itemName} from purchase${pid}`;
  } else if (action === 'edit') {
    desc = `Reduced ${absQty}× ${itemName} from purchase edit${pid}`;
  } else {
    desc = `Removed ${absQty}× ${itemName} from purchase${pid}`;
  }

  await logInventoryActivity({
    businessId: purchase.business,
    type,
    qty: absQty,
    desc,
    source: 'Purchase',
    userName,
    date,
    location: purchase.location,
    warehouseId: purchase.warehouse,
    storeId: purchase.storeId
  });
}

export async function syncPurchaseToInventory(purchase, supplierDoc, { previousQuantity, userName } = {}) {
  const businessId = purchase.business;
  const purchaseId = purchase.purchaseId;
  const meta = categoryMeta(purchase.category);
  const purchaseQty = Math.max(Number(purchase.quantity) || 0, 1);
  const location = purchase.location || '';
  const status = purchase.stockStatus || computeStockStatus(location);

  const existingItem = await Item.findOne({ business: businessId, purchaseId });
  if (!existingItem) {
    await enforceInventoryItemLimit(businessId, Item);
  }

  // When editing qty, apply a delta so sold/transferred units stay accounted for.
  // New inventory rows (or first sync) use the absolute purchase quantity.
  let qty = purchaseQty;
  let qtyDelta = purchaseQty;
  if (existingItem && previousQuantity != null) {
    const prev = Math.max(Number(previousQuantity) || 0, 0);
    qty = Math.max(0, (Number(existingItem.qty) || 0) + (purchaseQty - prev));
    qtyDelta = purchaseQty - prev;
  } else if (existingItem) {
    qtyDelta = purchaseQty - Math.max(Number(existingItem.qty) || 0, 0);
  }

  const [sku, itemId] = await Promise.all([
    resolveInventorySku(businessId, purchase),
    resolveInventoryItemId(businessId, purchase, existingItem)
  ]);

  const purchaseOid = String(purchase._id || purchase.id || '');
  const purchaseRef =
    purchaseOid && purchaseOid !== String(purchaseId || '') ? purchaseOid : undefined;

  let itemData = syncItemPricing({
    business: businessId,
    itemId,
    purchaseId,
    name: purchase.itemName,
    sku,
    category: purchase.category,
    group: normalizeGroup(purchase.group),
    qty,
    reorder: purchase.reorder ?? 5,
    location,
    status,
    targetPrice: Number(purchase.targetPrice) || 0,
    purchasePrice: Number(purchase.purchasePrice) || 0,
    supplierId: supplierDoc?.supplierId || '',
    purchaseDate: purchase.purchaseDate
      ? new Date(purchase.purchaseDate).toISOString().slice(0, 10)
      : '',
    notes: purchase.notes || '',
    photos: purchase.photos || [],
    icon: meta.icon,
    color: meta.color,
    ...(purchaseRef ? { purchase: purchaseRef } : {}),
    bale: null,
    storeId: ''
  });

  // Align warehouse / store / status from location (store purchases → In Store + storeId).
  itemData = await syncItemPlacementFromLocation(businessId, itemData, {
    existing: existingItem?.toObject?.() || existingItem
  });
  if (!itemData.warehouse && itemData.status !== 'In Store' && !isTransitLocation(location)) {
    itemData = await attachWarehouseFromLocation(businessId, itemData);
  }

  if (isTransitLocation(location)) {
    delete itemData.warehouse;
    const shipmentOid = await resolveShipmentForTransitItem(businessId);
    itemData.shipment = shipmentOid;
    itemData.storeId = '';
    if (shipmentOid) {
      const shp = await Shipment.findById(shipmentOid).select('origin dest shipmentId').lean();
      if (shp) itemData.location = formatTransitLocationLabel(shp);
    }
  }

  const saved = await Item.findOneAndUpdate(
    { business: businessId, purchaseId },
    { $set: itemData },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );

  if (!saved) {
    const err = new Error('Failed to sync purchase into inventory');
    err.statusCode = 500;
    throw err;
  }

  const action = existingItem ? 'edit' : 'receive';
  const logLocation = String(itemData.location || location || '').trim();
  const transit = isTransitLocation(logLocation) || isTransitLocation(location);
  try {
    await logPurchaseStockMovement(
      {
        ...(purchase.toObject?.() || purchase),
        location: logLocation || location,
        // Never attribute shipment receives to a warehouse fallback
        warehouse: transit ? undefined : saved?.warehouse || itemData.warehouse,
        storeId: transit ? '' : saved?.storeId || itemData.storeId
      },
      { qtyDelta, userName, action }
    );
  } catch (err) {
    // Inventory row is already correct — don't fail the purchase over activity-log write issues.
    console.warn('[purchase] stock movement log failed:', err?.message || err);
  }
}

export async function removeInventoryForPurchase(
  businessId,
  purchaseId,
  { userName = 'System', purchase = null } = {}
) {
  const purchaseOid = purchase?._id || purchase?.id;
  const or = [
    ...(purchaseId ? [{ purchaseId: String(purchaseId) }] : []),
    ...(purchaseOid ? [{ purchase: purchaseOid }] : [])
  ];
  const item = or.length
    ? await Item.findOne({ business: businessId, $or: or })
    : null;
  if (!item) {
    // Still log purchase-level removal when the linked stock row is already gone
    if (purchase) {
      const qty = Math.max(Number(purchase.quantity) || 0, 1);
      await logPurchaseStockMovement(
        { ...purchase, business: businessId, purchaseId },
        { qtyDelta: -qty, userName, action: 'delete' }
      );
    }
    return null;
  }

  const qty = Math.max(Number(item.qty) || 0, Number(purchase?.quantity) || 0, 1);
  await logPurchaseStockMovement(
    {
      business: businessId,
      purchaseId: purchaseId || item.purchaseId,
      itemName: item.name || purchase?.itemName || 'Item',
      location: item.location || purchase?.location || '',
      warehouse: item.warehouse,
      storeId: item.storeId,
      purchaseDate: purchase?.purchaseDate
    },
    { qtyDelta: -qty, userName, action: 'delete' }
  );
  await Item.deleteOne({ _id: item._id });
  return item;
}

/**
 * Apply (or adjust) a restock purchase against an existing inventory row.
 * Uses a quantity delta so edits/deletes stay consistent.
 */
export async function applyRestockToInventory(purchase, previousQuantity = 0, { userName } = {}) {
  const itemId = purchase.restockOf;
  if (!itemId) return null;

  const item = await Item.findOne({ business: purchase.business, _id: itemId });
  if (!item) {
    const err = new Error('Inventory item to restock was not found');
    err.statusCode = 404;
    throw err;
  }
  if (item.status === 'Sold' || item.status === 'Returned') {
    const err = new Error('Cannot restock a sold or returned item');
    err.statusCode = 400;
    throw err;
  }

  const prev = Math.max(Number(previousQuantity) || 0, 0);
  const next = Math.max(Number(purchase.quantity) || 0, 0);
  const delta = next - prev;
  const onHand = Math.max(Number(item.qty) || 0, 0);
  if (onHand + delta < 0) {
    const err = new Error(
      `Cannot reduce restock by ${-delta} unit(s); only ${onHand} currently on hand.`
    );
    err.statusCode = 400;
    throw err;
  }

  item.qty = onHand + delta;
  // Keep the existing unit purchase price — restock only adjusts quantity.
  // Changing cost/pricing for an SKU should be done via a new purchase.
  item.purchaseValue = (Number(item.purchasePrice) || 0) * item.qty;
  await item.save();

  await logPurchaseStockMovement(
    {
      ...(purchase.toObject?.() || purchase),
      itemName: item.name || purchase.itemName,
      location: item.location || purchase.location,
      warehouse: item.warehouse,
      storeId: item.storeId
    },
    { qtyDelta: delta, userName, action: 'restock' }
  );
  return item;
}

export async function reverseRestockFromInventory(purchase, { userName = 'System' } = {}) {
  if (!purchase?.restockOf) return;
  const qty = Math.max(Number(purchase.quantity) || 0, 0);
  if (!qty) return;
  const item = await Item.findOne({ business: purchase.business, _id: purchase.restockOf });
  if (!item) return;
  item.qty = Math.max(0, (Number(item.qty) || 0) - qty);
  item.purchaseValue = (Number(item.purchasePrice) || 0) * item.qty;
  await item.save();
  await logPurchaseStockMovement(
    {
      ...(purchase.toObject?.() || purchase),
      itemName: item.name || purchase.itemName,
      location: item.location || purchase.location,
      warehouse: item.warehouse,
      storeId: item.storeId
    },
    { qtyDelta: -qty, userName, action: 'delete' }
  );
}
