import { isValidId } from '../utils/ids.js';
import { Purchase, Supplier } from '../models/Purchase.js';
import Item from '../models/Item.js';
import ApiError, { asyncHandler } from '../utils/ApiError.js';
import { parsePagination, buildSearchFilter } from '../utils/tokens.js';
import {
  autoSku,
  computeStockStatus,
  formatPurchaseDoc,
  nextPurchaseId,
  nextSupplierId,
  normalizePurchaseBody,
  normalizePurchaseRecord,
  removeInventoryForPurchase,
  resolveSupplier,
  syncPurchaseToInventory,
  assertPurchaseQuantityEditable,
  applyRestockToInventory,
  reverseRestockFromInventory,
  formatSupplierRecord
} from '../utils/purchaseHelpers.js';
import {
  analyzePurchaseImageFromDataUrl,
  analyzePurchaseReceiptFromDataUrl,
  matchBulkItemPhotosToLines
} from '../services/purchaseImageAnalysis.service.js';
import {
  assertAiAnalysisAvailable,
  recordAiAnalysisUse,
  getBusinessSubscription
} from '../services/subscriptionService.js';
import { getPlanLimit } from '../constants/plans.js';
import { invalidateFinanceSync } from '../services/financeSync.service.js';
import { ensureCloudPhotos } from '../utils/ensureCloudPhotos.js';

function purchaseFilter(businessId, id) {
  const clauses = [{ purchaseId: id }];
  if (isValidId(id)) clauses.push({ _id: id });
  return { business: businessId, $or: clauses };
}

function supplierFilter(businessId, id) {
  const clauses = [{ supplierId: id }];
  if (isValidId(id)) clauses.push({ _id: id });
  return { business: businessId, $or: clauses };
}

function validateSavedPurchase(data, supplier) {
  if (!data.itemName) throw new ApiError(400, 'Item name is required');
  if (!data.quantity || data.quantity <= 0) throw new ApiError(400, 'Quantity is required');
  if (!data.purchasePrice) throw new ApiError(400, 'Purchase price is required');
  if (!data.targetPrice) throw new ApiError(400, 'Target price is required');
  if (!supplier) throw new ApiError(400, 'Please select a supplier');
  if (!data.purchaseDate) throw new ApiError(400, 'Purchase date is required');
}

async function applyPurchaseSave(
  doc,
  supplier,
  isNew,
  { previousQuantity, wasSaved, userName } = {}
) {
  if (doc.restockOf) {
    if (doc.status === 'saved') {
      await applyRestockToInventory(doc, wasSaved ? previousQuantity : 0, { userName });
    } else if (wasSaved) {
      await reverseRestockFromInventory(
        {
          ...(doc.toObject?.() || doc),
          quantity: previousQuantity ?? doc.quantity
        },
        { userName }
      );
    }
    return;
  }

  if (doc.status === 'saved') {
    await syncPurchaseToInventory(doc, supplier, { previousQuantity, userName });
  } else if (!isNew) {
    await removeInventoryForPurchase(doc.business, doc.purchaseId, {
      userName,
      purchase: doc.toObject?.() || doc
    });
  }
}

async function removePurchaseInventoryImpact(doc, { userName } = {}) {
  if (doc.status !== 'saved') return;
  if (doc.restockOf) {
    await reverseRestockFromInventory(doc, { userName });
    return;
  }
  await removeInventoryForPurchase(doc.business, doc.purchaseId, {
    userName,
    purchase: doc.toObject?.() || doc
  });
}

export const listPurchases = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query);
  const filter = { business: req.businessId };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.supplierId) {
    const supplier = await resolveSupplier(req.businessId, req.query.supplierId);
    if (supplier) filter.supplier = supplier._id;
  }
  Object.assign(filter, buildSearchFilter(req.query.search, ['purchaseId', 'itemName', 'sku', 'category']));

  const sortField = req.query.sort === 'createdAt' || req.query.sort === '-createdAt'
    ? { createdAt: req.query.sort.startsWith('-') ? -1 : 1 }
    : { createdAt: -1 };

  const fetchLimit = req.query.limit ? limit : 500;
  const fetchSkip = req.query.limit ? skip : 0;

  const [data, total] = await Promise.all([
    Purchase.find(filter).populate('supplier').sort(sortField).skip(fetchSkip).limit(fetchLimit),
    Purchase.countDocuments(filter)
  ]);

  const purchases = data.map((d) => normalizePurchaseRecord(d, d.supplier));

  res.json({
    ok: true,
    purchases,
    total,
    data: purchases,
    pagination: { page, limit: fetchLimit, total, pages: Math.ceil(total / fetchLimit) }
  });
});

export const getPurchase = asyncHandler(async (req, res) => {
  const doc = await Purchase.findOne(purchaseFilter(req.businessId, req.params.purchaseId)).populate('supplier');
  if (!doc) throw new ApiError(404, 'Purchase not found');
  res.json({ ok: true, data: normalizePurchaseRecord(doc, doc.supplier) });
});

export const createPurchase = asyncHandler(async (req, res) => {
  const normalized = normalizePurchaseBody(req.body);
  const { supplierRef, ...fields } = normalized;
  const purchaseId = await nextPurchaseId(req.businessId);
  fields.sku = autoSku(fields.category, purchaseId, fields.sku);
  if (fields.photos?.length) {
    fields.photos = await ensureCloudPhotos(fields.photos, { businessId: req.businessId });
  }

  const supplier = await resolveSupplier(req.businessId, supplierRef);
  if (fields.status === 'saved') validateSavedPurchase(fields, supplier);

  const doc = await Purchase.create({
    business: req.businessId,
    purchaseId,
    ...fields,
    supplier: supplier?._id
  });

  try {
    await applyPurchaseSave(doc, supplier, true, {
      userName: req.userDoc?.name || req.userDoc?.email || 'System'
    });
  } catch (err) {
    await Item.deleteMany({ business: req.businessId, purchaseId: doc.purchaseId });
    await Purchase.deleteOne({ _id: doc._id });
    if (err?.code === 11000 || err?.code === 'P2002') {
      throw new ApiError(
        409,
        'Could not add this purchase to inventory because the SKU is already in use. Try a different SKU.'
      );
    }
    throw err;
  }

  await doc.populate('supplier');
  invalidateFinanceSync(req.businessId);
  res.status(201).json({ ok: true, data: normalizePurchaseRecord(doc, doc.supplier) });
});

export const updatePurchase = asyncHandler(async (req, res) => {
  const existing = await Purchase.findOne(purchaseFilter(req.businessId, req.params.purchaseId));
  if (!existing) throw new ApiError(404, 'Purchase not found');

  const body = { ...req.body };
  const previousQuantity = Math.max(Number(existing.quantity) || 0, 0);

  const normalized = normalizePurchaseBody(body, existing);
  const { supplierRef, ...fields } = normalized;
  fields.sku = autoSku(
    fields.category || existing.category,
    existing.purchaseId,
    fields.sku || existing.sku
  );

  const supplier = await resolveSupplier(
    req.businessId,
    supplierRef ?? (existing.supplier?._id || existing.supplier)
  );
  if (fields.status === 'saved') validateSavedPurchase(fields, supplier);
  if (fields.photos?.length) {
    fields.photos = await ensureCloudPhotos(fields.photos, { businessId: req.businessId });
  }

  // Quantity is editable; block reductions below units already sold/transferred.
  // Restock purchases adjust an existing item by delta — skip original-purchase stock guards.
  const willBeSaved = fields.status === 'saved';
  const wasSaved = existing.status === 'saved';
  if (!existing.restockOf && willBeSaved && (wasSaved || Number(fields.quantity) !== previousQuantity)) {
    try {
      await assertPurchaseQuantityEditable(
        req.businessId,
        existing.purchaseId,
        previousQuantity,
        fields.quantity
      );
    } catch (err) {
      throw new ApiError(err.statusCode || 400, err.message);
    }
  }

  Object.assign(existing, fields, { supplier: supplier?._id || existing.supplier });
  await existing.save();
  try {
    await applyPurchaseSave(existing, supplier, false, {
      previousQuantity: wasSaved ? previousQuantity : undefined,
      wasSaved,
      userName: req.userDoc?.name || req.userDoc?.email || 'System'
    });
  } catch (err) {
    if (err?.statusCode) throw new ApiError(err.statusCode, err.message);
    if (err?.code === 11000) {
      throw new ApiError(
        409,
        'Could not add this purchase to inventory because the SKU is already in use. Try a different SKU.'
      );
    }
    throw err;
  }
  await existing.populate('supplier');
  invalidateFinanceSync(req.businessId);
  res.json({ ok: true, data: normalizePurchaseRecord(existing, existing.supplier) });
});

export const bulkUpdatePurchases = asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  const updates = { ...(req.body.updates || {}) };
  if (!ids.length) throw new ApiError(400, 'No purchase ids provided');

  const allowed = {};
  if ('location' in updates) allowed.location = String(updates.location || '');
  if ('notes' in updates) allowed.notes = String(updates.notes || '').slice(0, 500);
  if ('status' in updates) {
    if (!['draft', 'saved'].includes(updates.status)) {
      throw new ApiError(400, 'Status must be draft or saved');
    }
    allowed.status = updates.status;
  }
  if (!Object.keys(allowed).length) throw new ApiError(400, 'No fields to update');

  let updated = 0;
  const errors = [];

  for (const id of ids) {
    const existing = await Purchase.findOne(purchaseFilter(req.businessId, id));
    if (!existing) {
      errors.push({ id, message: 'Not found' });
      continue;
    }

    try {
      if ('location' in allowed) {
        existing.location = allowed.location;
        existing.stockStatus = computeStockStatus(allowed.location);
      }
      if ('notes' in allowed) existing.notes = allowed.notes;
      if ('status' in allowed) existing.status = allowed.status;

      const supplier = await resolveSupplier(req.businessId, existing.supplier?._id || existing.supplier);
      if (existing.status === 'saved') {
        validateSavedPurchase(
          {
            itemName: existing.itemName,
            quantity: existing.quantity,
            purchasePrice: existing.purchasePrice,
            targetPrice: existing.targetPrice,
            purchaseDate: existing.purchaseDate
          },
          supplier
        );
      }

      await existing.save();
      await applyPurchaseSave(existing, supplier, false, {
        userName: req.userDoc?.name || req.userDoc?.email || 'System'
      });
      updated += 1;
    } catch (err) {
      errors.push({ id, message: err.message || 'Update failed' });
    }
  }

  if (updated) invalidateFinanceSync(req.businessId);

  res.json({
    ok: true,
    updated,
    failed: errors.length,
    errors,
    message:
      errors.length && updated
        ? `Updated ${updated} purchase(s); ${errors.length} failed`
        : errors.length
          ? `Could not update selected purchases`
          : `Updated ${updated} purchase${updated !== 1 ? 's' : ''}`
  });
});

export const bulkDeletePurchases = asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  if (!ids.length) throw new ApiError(400, 'No purchase ids provided');
  const userName = req.userDoc?.name || req.userDoc?.email || 'System';

  let deleted = 0;
  for (const id of ids) {
    const doc = await Purchase.findOneAndDelete(purchaseFilter(req.businessId, id));
    if (doc) {
      await removePurchaseInventoryImpact(doc, { userName });
      deleted += 1;
    }
  }

  invalidateFinanceSync(req.businessId);
  res.json({ ok: true, deleted });
});

export const deletePurchase = asyncHandler(async (req, res) => {
  const doc = await Purchase.findOneAndDelete(purchaseFilter(req.businessId, req.params.purchaseId));
  if (!doc) throw new ApiError(404, 'Purchase not found');
  await removePurchaseInventoryImpact(doc, {
    userName: req.userDoc?.name || req.userDoc?.email || 'System'
  });
  invalidateFinanceSync(req.businessId);
  res.json({ ok: true, message: 'Deleted' });
});

export const listSuppliers = asyncHandler(async (req, res) => {
  const filter = {
    business: req.businessId,
    ...buildSearchFilter(req.query.search, ['name', 'supplierId', 'city', 'country', 'email', 'phone'])
  };
  const wantsPage = req.query.page != null || req.query.limit != null || req.query.pageSize != null;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || req.query.pageSize, 10) || 25));
  const skip = (page - 1) * limit;

  const [suppliers, total, purchasesForCounts] = await Promise.all([
    wantsPage
      ? Supplier.find(filter).sort({ name: 1 }).skip(skip).limit(limit)
      : Supplier.find(filter).sort({ name: 1 }),
    wantsPage ? Supplier.countDocuments(filter) : Promise.resolve(null),
    Purchase.find({ business: req.businessId, supplier: { $ne: null } })
      .select('supplier purchaseValue')
      .lean()
  ]);

  const countMap = {};
  for (const p of purchasesForCounts) {
    const key = String(p.supplier);
    if (!countMap[key]) countMap[key] = { purchaseCount: 0, totalPurchaseValue: 0 };
    countMap[key].purchaseCount += 1;
    countMap[key].totalPurchaseValue += p.purchaseValue || 0;
  }
  const data = suppliers.map((s) =>
    formatSupplierRecord(s, {
      purchaseCount: countMap[String(s._id)]?.purchaseCount || 0,
      totalPurchaseValue: countMap[String(s._id)]?.totalPurchaseValue || 0
    })
  );

  if (!wantsPage) {
    return res.json({ ok: true, data });
  }

  const totalCount = total ?? data.length;
  res.json({
    ok: true,
    data,
    pagination: {
      page,
      pageSize: limit,
      total: totalCount,
      pages: Math.max(1, Math.ceil(totalCount / limit))
    }
  });
});

export const getSupplier = asyncHandler(async (req, res) => {
  const doc = await Supplier.findOne(supplierFilter(req.businessId, req.params.id));
  if (!doc) throw new ApiError(404, 'Supplier not found');

  const [purchaseCount, supplierPurchases, recentPurchases] = await Promise.all([
    Purchase.countDocuments({ business: req.businessId, supplier: doc._id }),
    Purchase.find({ business: req.businessId, supplier: doc._id }).select('purchaseValue').lean(),
    Purchase.find({ business: req.businessId, supplier: doc._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('supplier')
  ]);
  const totalPurchaseValue = supplierPurchases.reduce((s, p) => s + (p.purchaseValue || 0), 0);

  const recent = recentPurchases.map((p) => normalizePurchaseRecord(p, p.supplier));

  res.json({
    ok: true,
    data: formatSupplierRecord(doc, { purchaseCount, totalPurchaseValue }),
    recentPurchases: recent
  });
});

function pickSupplierFields(body) {
  return {
    name: (body.name || '').trim(),
    city: (body.city || '').trim(),
    country: body.country || 'CM',
    email: (body.email || '').trim(),
    phone: (body.phone || '').trim(),
    rating: body.rating != null && body.rating !== '' ? Number(body.rating) : undefined
  };
}

export const createSupplier = asyncHandler(async (req, res) => {
  const fields = pickSupplierFields(req.body);
  if (!fields.name) throw new ApiError(400, 'Supplier name is required');

  if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    throw new ApiError(400, 'Invalid email format');
  }

  const supplierId = await nextSupplierId(req.businessId);
  const doc = await Supplier.create({
    business: req.businessId,
    supplierId,
    name: fields.name,
    city: fields.city,
    country: fields.country,
    email: fields.email,
    phone: fields.phone,
    rating: Number.isFinite(fields.rating) ? fields.rating : 4.0
  });

  res.status(201).json({ ok: true, data: formatSupplierRecord(doc) });
});

export const updateSupplier = asyncHandler(async (req, res) => {
  const fields = pickSupplierFields(req.body);
  if (fields.name === '') throw new ApiError(400, 'Supplier name is required');

  if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
    throw new ApiError(400, 'Invalid email format');
  }

  const update = {};
  if (fields.name) update.name = fields.name;
  if (req.body.city !== undefined) update.city = fields.city;
  if (req.body.country !== undefined) update.country = fields.country;
  if (req.body.email !== undefined) update.email = fields.email;
  if (req.body.phone !== undefined) update.phone = fields.phone;
  if (Number.isFinite(fields.rating)) update.rating = fields.rating;

  const doc = await Supplier.findOneAndUpdate(
    supplierFilter(req.businessId, req.params.id),
    update,
    { new: true, runValidators: true }
  );
  if (!doc) throw new ApiError(404, 'Supplier not found');
  res.json({ ok: true, data: formatSupplierRecord(doc) });
});

export const deleteSupplier = asyncHandler(async (req, res) => {
  const doc = await Supplier.findOne(supplierFilter(req.businessId, req.params.id));
  if (!doc) throw new ApiError(404, 'Supplier not found');

  const linked = await Purchase.countDocuments({ business: req.businessId, supplier: doc._id });
  if (linked > 0) {
    throw new ApiError(
      400,
      `Cannot delete "${doc.name}" — ${linked} purchase record${linked === 1 ? '' : 's'} linked. Reassign or delete those purchases first.`
    );
  }

  await doc.deleteOne();
  res.json({ ok: true, message: 'Deleted' });
});

export const bulkDeleteSuppliers = asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  if (!ids.length) throw new ApiError(400, 'No supplier ids provided');

  let deleted = 0;
  const skipped = [];

  for (const id of ids) {
    const doc = await Supplier.findOne(supplierFilter(req.businessId, id));
    if (!doc) {
      skipped.push({ id, message: 'Not found' });
      continue;
    }
    const linked = await Purchase.countDocuments({ business: req.businessId, supplier: doc._id });
    if (linked > 0) {
      skipped.push({
        id: doc.supplierId || id,
        name: doc.name,
        message: `${linked} linked purchase(s)`
      });
      continue;
    }
    await doc.deleteOne();
    deleted += 1;
  }

  res.json({
    ok: true,
    deleted,
    skippedCount: skipped.length,
    skipped,
    message:
      skipped.length && deleted
        ? `Deleted ${deleted} supplier(s); ${skipped.length} skipped (linked purchases or missing)`
        : skipped.length
          ? 'No suppliers deleted — linked purchases or not found'
          : `Deleted ${deleted} supplier${deleted !== 1 ? 's' : ''}`
  });
});

/** AI vision — extract purchase fields from a product photo */
export const analyzePurchaseImage = asyncHandler(async (req, res) => {
  const images = req.body?.images || (req.body?.image ? [req.body.image] : []);
  if (!Array.isArray(images) || !images.length) {
    throw new ApiError(400, 'Provide at least one image as a base64 data URL');
  }

  const image = images.find((img) => typeof img === 'string' && img.startsWith('data:image/'));
  if (!image) {
    throw new ApiError(400, 'No valid image found — use data:image/...;base64,... format');
  }

  await assertAiAnalysisAvailable(req.businessId);

  try {
    const data = await analyzePurchaseImageFromDataUrl(image);
    const usage = await recordAiAnalysisUse(req.businessId);
    const { planId } = await getBusinessSubscription(req.businessId);
    const limit = getPlanLimit(planId, 'aiAnalysesPerMonth');
    res.json({
      ok: true,
      data,
      usage: {
        aiAnalysesThisMonth: usage.used,
        aiAnalysesPerMonth: limit,
        remaining: limit == null ? null : Math.max(0, limit - usage.used)
      },
      message: 'AI analysis complete — review suggestions before saving'
    });
  } catch (err) {
    throw new ApiError(err.statusCode || 502, err.message || 'AI analysis failed');
  }
});

/** AI vision — extract multiple line items from a receipt / invoice photo */
export const analyzePurchaseReceipt = asyncHandler(async (req, res) => {
  const images = req.body?.images || (req.body?.image ? [req.body.image] : []);
  if (!Array.isArray(images) || !images.length) {
    throw new ApiError(400, 'Provide at least one image as a base64 data URL');
  }

  const image = images.find((img) => typeof img === 'string' && img.startsWith('data:image/'));
  if (!image) {
    throw new ApiError(400, 'No valid image found — use data:image/...;base64,... format');
  }

  await assertAiAnalysisAvailable(req.businessId);

  try {
    const data = await analyzePurchaseReceiptFromDataUrl(image);
    const usage = await recordAiAnalysisUse(req.businessId);
    const { planId } = await getBusinessSubscription(req.businessId);
    const limit = getPlanLimit(planId, 'aiAnalysesPerMonth');
    res.json({
      ok: true,
      data,
      usage: {
        aiAnalysesThisMonth: usage.used,
        aiAnalysesPerMonth: limit,
        remaining: limit == null ? null : Math.max(0, limit - usage.used)
      },
      message: data.items?.length
        ? `AI found ${data.items.length} line item${data.items.length === 1 ? '' : 's'} — review before saving`
        : 'AI could not read line items from this receipt — add rows manually'
    });
  } catch (err) {
    throw new ApiError(err.statusCode || 502, err.message || 'AI receipt analysis failed');
  }
});

/** AI vision — match product photos to bulk purchase line items */
export const matchBulkItemPhotos = asyncHandler(async (req, res) => {
  const photos = req.body?.photos || req.body?.images || [];
  const lines = Array.isArray(req.body?.lines) ? req.body.lines : [];
  if (!Array.isArray(photos) || !photos.length) {
    throw new ApiError(400, 'Provide at least one product photo as a base64 data URL');
  }

  const validPhotos = photos.filter((img) => typeof img === 'string' && img.startsWith('data:image/'));
  if (!validPhotos.length) {
    throw new ApiError(400, 'No valid image found — use data:image/...;base64,... format');
  }

  await assertAiAnalysisAvailable(req.businessId);

  try {
    const data = await matchBulkItemPhotosToLines(validPhotos, lines);
    const usage = await recordAiAnalysisUse(req.businessId);
    const { planId } = await getBusinessSubscription(req.businessId);
    const limit = getPlanLimit(planId, 'aiAnalysesPerMonth');
    const matched = (data.matches || []).filter((m) => m.lineKey).length;
    res.json({
      ok: true,
      data,
      usage: {
        aiAnalysesThisMonth: usage.used,
        aiAnalysesPerMonth: limit,
        remaining: limit == null ? null : Math.max(0, limit - usage.used)
      },
      message: matched
        ? `AI matched ${matched} of ${validPhotos.length} photo(s) to line items — review before saving`
        : 'AI could not confidently match photos — assign them manually'
    });
  } catch (err) {
    throw new ApiError(err.statusCode || 502, err.message || 'AI photo matching failed');
  }
});

/**
 * Create many saved purchases from one receipt batch.
 * Shared supplier / date / location (location may be empty).
 * Each line may include its own photos (AI-matched product images).
 */
export const createBulkPurchases = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) throw new ApiError(400, 'Add at least one purchase line');
  if (items.length > 40) throw new ApiError(400, 'Bulk purchase is limited to 40 lines');

  const sharedLocation = String(body.location || '').trim();
  const purchaseDate = body.purchaseDate || new Date().toISOString().slice(0, 10);
  const supplier = await resolveSupplier(req.businessId, body.supplierId || body.supplier);
  if (!supplier) throw new ApiError(400, 'Please select a supplier');

  // Shared photos only as fallback when a line has none (legacy clients)
  let sharedPhotos = Array.isArray(body.photos) ? body.photos.slice(0, 12) : [];
  if (sharedPhotos.length) {
    sharedPhotos = await ensureCloudPhotos(sharedPhotos, { businessId: req.businessId });
  }

  const userName = req.userDoc?.name || req.userDoc?.email || 'System';
  const created = [];
  const errors = [];

  for (let i = 0; i < items.length; i += 1) {
    const line = items[i] || {};
    try {
      let linePhotos = Array.isArray(line.photos) ? line.photos.slice(0, 12) : [];
      if (linePhotos.length) {
        linePhotos = await ensureCloudPhotos(linePhotos, { businessId: req.businessId });
      } else if (sharedPhotos.length) {
        linePhotos = sharedPhotos;
      }

      const normalized = normalizePurchaseBody({
        status: 'saved',
        itemName: line.itemName,
        sku: line.sku || '',
        category: line.category || 'Clothes',
        group: line.group || null,
        quantity: line.quantity,
        purchasePrice: line.purchasePrice,
        targetPrice: line.targetPrice,
        location: sharedLocation,
        supplierId: supplier.supplierId,
        purchaseDate,
        notes: line.notes || '',
        photos: linePhotos
      });
      const { supplierRef, ...fields } = normalized;
      validateSavedPurchase(fields, supplier);

      const purchaseId = await nextPurchaseId(req.businessId);
      fields.sku = autoSku(fields.category, purchaseId, fields.sku);

      const doc = await Purchase.create({
        business: req.businessId,
        purchaseId,
        ...fields,
        supplier: supplier._id
      });

      try {
        await syncPurchaseToInventory(doc, supplier, { userName });
      } catch (err) {
        await Purchase.deleteOne({ _id: doc._id });
        await Item.deleteMany({ business: req.businessId, purchaseId });
        throw err;
      }

      created.push(normalizePurchaseRecord(doc, supplier));
    } catch (err) {
      errors.push({
        index: i,
        itemName: line.itemName || `Line ${i + 1}`,
        message: err.message || 'Failed to save line'
      });
    }
  }

  if (!created.length) {
    throw new ApiError(400, errors[0]?.message || 'Could not save any purchase lines');
  }

  invalidateFinanceSync(req.businessId);
  res.status(201).json({
    ok: true,
    data: created,
    created: created.length,
    failed: errors.length,
    errors,
    message: errors.length
      ? `Saved ${created.length} purchase(s); ${errors.length} failed`
      : `Saved ${created.length} purchase(s) to inventory`
  });
});
