import { createNoopSession } from '../utils/noopSession.js';
import Bale from '../models/Bale.js';
import Item from '../models/Item.js';
import ApiError, { asyncHandler } from '../utils/ApiError.js';
import { categoryMeta, syncItemPricing } from '../constants/inventory.js';
import {
  activeBaleItems,
  applyBaleCategoryDefaults,
  baleActiveUnits,
  baleItemQty,
  baleItemStockSku,
  filterBales,
  baleListQuery,
  findMatchingBaleItem,
  generateBaleSku,
  nextBaleHumanId,
  nextBaleItemId,
  recalcBale,
  returnedBaleItems
} from '../utils/baleHelpers.js';
import { attachWarehouseFromLocation } from '../utils/warehouseHelpers.js';
import { findStore } from '../utils/storeHelpers.js';
import { unpackBaleToStore } from '../utils/baleHelpers.js';
import { ensureCloudPhotos } from '../utils/ensureCloudPhotos.js';
import { invalidateFinanceSync } from '../services/financeSync.service.js';

async function loadBale(businessId, id) {
  const bale = await Bale.findOne({ _id: id, business: businessId });
  if (!bale) throw new ApiError(404, 'Grouped item not found');
  return bale;
}

function formatBale(doc) {
  const b = doc.toObject ? doc.toObject() : doc;
  b.id = b.baleId || String(b._id);
  return b;
}

export const listBales = asyncHandler(async (req, res) => {
  const filter = baleListQuery(req.businessId, req.query);
  const all = await Bale.find(filter).select('-items').sort({ name: 1 }).limit(500).lean();
  const filtered = all.map((b) => {
    const row = { ...b, id: b.baleId || String(b._id) };
    return row;
  });
  const stats = {
    count: filtered.length,
    totalValue: filtered.reduce((s, b) => s + (b.value || 0), 0),
    totalItems: filtered.reduce((s, b) => s + (b.itemCount || b.totalUnits || 0), 0)
  };
  res.json({ ok: true, data: filtered, items: filtered, count: filtered.length, stats });
});

export const getBale = asyncHandler(async (req, res) => {
  const bale = await loadBale(req.businessId, req.params.id);
  recalcBale(bale);
  res.json({ ok: true, data: formatBale(bale) });
});

export const createBale = asyncHandler(async (req, res) => {
  const { name, sku, category, location, weight, buyValue, value, source } = req.body;
  if (!name?.trim()) throw new ApiError(400, 'Name is required');

  const existing = await Bale.find({ business: req.businessId });
  const cat = category || 'Clothes';
  const doc = {
    business: req.businessId,
    baleId: await nextBaleHumanId(Bale, req.businessId),
    name: name.trim(),
    sku: sku || generateBaleSku(cat, existing),
    category: cat,
    location: location || '',
    weight: weight || '',
    buyValue: Number(buyValue) || 0,
    value: Number(value) || 0,
    source: source || req.body.notes || '',
    items: [],
    status: 'Stored'
  };
  applyBaleCategoryDefaults(doc);
  recalcBale(doc);
  await attachWarehouseFromLocation(req.businessId, doc);
  const bale = await Bale.create(doc);
  res.status(201).json({ ok: true, data: formatBale(bale) });
});

export const updateBale = asyncHandler(async (req, res) => {
  const bale = await loadBale(req.businessId, req.params.id);
  const fields = ['name', 'sku', 'category', 'location', 'weight', 'buyValue', 'value', 'source', 'status'];
  fields.forEach((f) => {
    if (req.body[f] !== undefined) bale[f] = req.body[f];
  });
  if (req.body.category) applyBaleCategoryDefaults(bale);
  if (req.body.location !== undefined) {
    bale.warehouse = null;
    await attachWarehouseFromLocation(req.businessId, bale);
  }
  recalcBale(bale);
  await bale.save();
  res.json({ ok: true, data: formatBale(bale) });
});

export const bulkDeleteBales = asyncHandler(async (req, res) => {
  const ids = req.body.ids || [];
  if (!ids.length) throw new ApiError(400, 'No groups selected');
  const result = await Bale.deleteMany({
    business: req.businessId,
    $or: [{ _id: { $in: ids } }, { baleId: { $in: ids } }]
  });
  res.json({ ok: true, message: `Deleted ${result.deletedCount} grouped item(s)`, deletedCount: result.deletedCount });
});

export const addBaleItem = asyncHandler(async (req, res) => {
  const bale = await loadBale(req.businessId, req.params.baleId);
  const body = req.body;
  if (!body.name?.trim()) throw new ApiError(400, 'Item name is required');

  const photos = await ensureCloudPhotos(body.photos || [], { businessId: req.businessId });
  const candidate = {
    name: body.name.trim(),
    subtitle: body.subtitle || '',
    category: body.category || bale.category,
    condition: body.condition || '',
    grade: body.grade || 'B',
    purchasePrice: Number(body.purchasePrice) || 0,
    targetPrice: Number(body.targetPrice) || 0,
    priceXaf: Number(body.targetPrice || body.priceXaf) || 0,
    photos,
    qty: 1,
    returned: false
  };
  const meta = categoryMeta(candidate.category);
  candidate.icon = meta.icon;
  candidate.color = meta.color;

  const match = findMatchingBaleItem(bale, candidate);
  if (match) {
    match.qty = baleItemQty(match) + 1;
  } else {
    bale.items.push({ ...candidate, id: nextBaleItemId(bale) });
  }
  recalcBale(bale);
  await bale.save();
  res.status(201).json({ ok: true, data: formatBale(bale) });
});

export const updateBaleItem = asyncHandler(async (req, res) => {
  const bale = await loadBale(req.businessId, req.params.baleId);
  const line = bale.items.find((i) => i.id === req.params.itemId);
  if (!line) throw new ApiError(404, 'Line item not found');

  ['name', 'subtitle', 'category', 'condition', 'grade'].forEach((f) => {
    if (req.body[f] !== undefined) line[f] = req.body[f];
  });
  if (req.body.photos !== undefined) {
    line.photos = await ensureCloudPhotos(req.body.photos || [], { businessId: req.businessId });
  }
  if (req.body.purchasePrice !== undefined) line.purchasePrice = Number(req.body.purchasePrice) || 0;
  if (req.body.targetPrice !== undefined) {
    line.targetPrice = Number(req.body.targetPrice) || 0;
    line.priceXaf = line.targetPrice;
  }
  const meta = categoryMeta(line.category);
  line.icon = meta.icon;
  line.color = meta.color;

  recalcBale(bale);
  await bale.save();
  res.json({ ok: true, data: formatBale(bale) });
});

export const deleteBaleItems = asyncHandler(async (req, res) => {
  const bale = await loadBale(req.businessId, req.params.baleId);
  const keys = req.body.keys || req.body.itemIds || [];
  const ids = keys.map((k) => (String(k).includes(':') ? String(k).split(':').pop() : k));
  bale.items = bale.items.filter((i) => !ids.includes(i.id));
  recalcBale(bale);
  await bale.save();
  res.json({ ok: true, data: formatBale(bale), message: 'Items deleted' });
});

export const removeBaleItemToStock = asyncHandler(async (req, res) => {
  const qty = Math.max(1, parseInt(req.body.qty, 10) || 1);
  const session = createNoopSession();
  session.startTransaction();
  try {
    const bale = await Bale.findOne({ _id: req.params.baleId, business: req.businessId }).session(session);
    if (!bale) throw new ApiError(404, 'Grouped item not found');
    const line = bale.items.find((i) => i.id === req.params.itemId && !i.returned);
    if (!line) throw new ApiError(404, 'Item not found in group');

    const currentQty = baleItemQty(line);
    const moveQty = Math.min(qty, currentQty);
    const unitVal = line.targetPrice || line.priceXaf || 0;
    const unitCost = line.purchasePrice || 0;
    const sku = baleItemStockSku(line) || `${bale.sku}-${line.id}`;

    let stock = await Item.findOne({
      business: req.businessId,
      sku,
      name: line.name,
      category: line.category,
      status: { $ne: 'Sold' },
      $or: [{ bale: null }, { bale: { $exists: false } }]
    }).session(session);

    if (stock) {
      stock.qty += moveQty;
      stock.targetPrice = unitVal;
      stock.purchasePrice = unitCost;
      syncItemPricing(stock);
      await stock.save({ session });
    } else {
      const itemData = {
        business: req.businessId,
        name: line.name,
        sku,
        category: line.category,
        qty: moveQty,
        reorder: 5,
        location: bale.location,
        status: 'Stored',
        targetPrice: unitVal,
        purchasePrice: unitCost,
        icon: line.icon,
        color: line.color,
        photos: line.photos || [],
        createdBy: req.userDoc._id
      };
      syncItemPricing(itemData);
      const meta = categoryMeta(itemData.category);
      itemData.icon = line.icon || meta.icon;
      itemData.color = line.color || meta.color;
      const created = await Item.create([itemData], { session });
      stock = created[0];
    }

    if (currentQty <= moveQty) {
      bale.items = bale.items.filter((i) => i.id !== line.id);
    } else {
      line.qty = currentQty - moveQty;
    }
    recalcBale(bale);
    await bale.save({ session });
    await session.commitTransaction();
    if (unitCost > 0) invalidateFinanceSync(req.businessId);
    res.json({
      ok: true,
      message: `${moveQty} unit(s) moved to individual stock`,
      data: formatBale(bale),
      item: stock
    });
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
});

export const bulkRemoveBaleItemsToStock = asyncHandler(async (req, res) => {
  const itemIds = req.body.itemIds || [];
  if (!itemIds.length) throw new ApiError(400, 'No items selected');

  const session = createNoopSession();
  session.startTransaction();
  try {
    const bale = await Bale.findOne({ _id: req.params.baleId, business: req.businessId }).session(session);
    if (!bale) throw new ApiError(404, 'Grouped item not found');

    for (const itemId of itemIds) {
      const line = bale.items.find((i) => i.id === itemId && !i.returned);
      if (!line) continue;
      const moveQty = 1;
      const unitVal = line.targetPrice || line.priceXaf || 0;
      const unitCost = line.purchasePrice || 0;
      const sku = baleItemStockSku(line) || `${bale.sku}-${line.id}`;
      let stock = await Item.findOne({
        business: req.businessId,
        sku,
        name: line.name,
        status: { $ne: 'Sold' }
      }).session(session);
      if (stock) {
        stock.qty += moveQty;
        syncItemPricing(stock);
        await stock.save({ session });
      } else {
        const meta = categoryMeta(line.category);
        const itemData = {
          business: req.businessId,
          name: line.name,
          sku,
          category: line.category,
          qty: moveQty,
          location: bale.location,
          status: 'Stored',
          targetPrice: unitVal,
          purchasePrice: unitCost,
          icon: line.icon || meta.icon,
          color: line.color || meta.color,
          createdBy: req.userDoc._id
        };
        syncItemPricing(itemData);
        await Item.create([itemData], { session });
      }
      const currentQty = baleItemQty(line);
      if (currentQty <= moveQty) {
        bale.items = bale.items.filter((i) => i.id !== itemId);
      } else {
        line.qty = currentQty - moveQty;
      }
    }
    recalcBale(bale);
    await bale.save({ session });
    await session.commitTransaction();
    invalidateFinanceSync(req.businessId);
    res.json({ ok: true, data: formatBale(bale), message: 'Items moved to individual stock' });
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
});

/** Picker list — lightweight */
export const listBalesForPicker = listBales;

export const baleStats = asyncHandler(async (req, res) => {
  const bales = await Bale.find({ business: req.businessId });
  res.json({
    ok: true,
    count: bales.length,
    totalItems: bales.reduce((s, b) => s + baleActiveUnits(b), 0),
    returnedCount: bales.reduce((s, b) => s + returnedBaleItems(b).length, 0)
  });
});

/** Unpack grouped item onto store shelf (POS) and remove the bale. */
export const sendBaleToStore = asyncHandler(async (req, res) => {
  const { storeId } = req.body;
  if (!storeId) throw new ApiError(400, 'storeId is required');

  const store = await findStore(req.businessId, storeId);
  const bale = await loadBale(req.businessId, req.params.id);

  const session = createNoopSession();
  session.startTransaction();
  try {
    const result = await unpackBaleToStore({
      businessId: req.businessId,
      bale,
      store,
      userId: req.userDoc._id,
      session
    });
    await session.commitTransaction();
    res.json({
      ok: true,
      unpackedUnits: result.totalUnits,
      message: `Sent ${result.totalUnits} unit(s) to ${store.name}. They are now on the POS shelf.`
    });
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
});
