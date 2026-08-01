import FinanceEntry from '../models/FinanceEntry.js';
import PosTransaction from '../models/PosTransaction.js';
import Sale from '../models/Sale.js';
import { Purchase } from '../models/Purchase.js';
import Shipment from '../models/Shipment.js';
import SalesReturn from '../models/SalesReturn.js';
import Item from '../models/Item.js';
import { toXaf } from '../utils/financeHelpers.js';
import { productsFromLines, revenueDescriptionFromProducts } from '../utils/financeProductHelpers.js';

const SYNC_TTL_MS = 2 * 60 * 1000;
const syncCache = new Map();
const inflight = new Map();
const syncGeneration = new Map();

/** Re-query operational rows so prune never drops entries created mid-sync. */
async function refreshActiveLinkedIds(businessId, activeLinkedIds) {
  const [txns, sales, purchases, shipments, returns, stockItems] = await Promise.all([
    PosTransaction.find({ business: businessId, status: 'completed' }).select('transactionId').lean(),
    Sale.find({ business: businessId, status: 'completed' }).select('saleId source').lean(),
    Purchase.find({ business: businessId, status: 'saved' })
      .select('purchaseId purchaseValue purchasePrice quantity')
      .lean(),
    Shipment.find({ business: businessId })
      .select('_id shipmentId goodsCost shippingCost dutiesCost salesRevenue')
      .lean(),
    SalesReturn.find({ business: businessId, status: 'Completed' }).select('returnId refundAmount').lean(),
    Item.find({
      business: businessId,
      $and: [
        { $or: [{ purchasePrice: { $gt: 0 } }, { purchaseValue: { $gt: 0 } }] },
        {
          $or: [
            { purchaseId: { $exists: false } },
            { purchaseId: null },
            { purchaseId: '' }
          ]
        },
        {
          $or: [{ purchase: { $exists: false } }, { purchase: null }]
        },
        // Transfer splits keep cost lineage here — already booked via Purchases
        {
          $or: [
            { sourcedFromPurchaseId: { $exists: false } },
            { sourcedFromPurchaseId: null },
            { sourcedFromPurchaseId: '' }
          ]
        }
      ]
    })
      .select('itemId _id purchasePrice purchaseValue qty shipment')
      .lean()
  ]);

  const shipmentsWithGoodsCost = new Set(
    shipments.filter((s) => s.goodsCost > 0).map((s) => String(s._id))
  );

  for (const t of txns) activeLinkedIds.add(`pos-${t.transactionId}`);
  for (const sale of sales) {
    if ((sale.source || 'POS') === 'POS') continue;
    activeLinkedIds.add(`sale-${sale.saleId}`);
  }
  for (const p of purchases) {
    if (purchaseAmount(p)) activeLinkedIds.add(`purchase-${p.purchaseId}`);
  }
  for (const s of shipments) {
    if (s.goodsCost > 0) activeLinkedIds.add(`ship-goods-${s.shipmentId}`);
    if (s.shippingCost > 0) activeLinkedIds.add(`ship-freight-${s.shipmentId}`);
    if (s.dutiesCost > 0) activeLinkedIds.add(`ship-duties-${s.shipmentId}`);
    if (s.salesRevenue > 0) activeLinkedIds.add(`ship-sales-${s.shipmentId}`);
  }
  for (const r of returns) {
    if (r.refundAmount) activeLinkedIds.add(`sales-return-${r.returnId}`);
  }
  for (const item of stockItems) {
    if (item.shipment && shipmentsWithGoodsCost.has(String(item.shipment))) continue;
    if (itemCogsAmount(item)) activeLinkedIds.add(itemCogsLinkedId(item));
  }

  return activeLinkedIds;
}

function entryChanged(prev, next) {
  if (!prev) return true;
  return (
    prev.amount !== next.amount ||
    prev.amountXaf !== next.amountXaf ||
    prev.description !== next.description ||
    prev.category !== next.category ||
    String(prev.date) !== String(next.date) ||
    JSON.stringify(prev.products || []) !== JSON.stringify(next.products || [])
  );
}

function buildUpsert(businessId, linkedId, data) {
  const amountXaf = toXaf(data.amount, data.currency || 'XAF');
  const products = data.products || [];
  return {
    linkedId,
    doc: {
      business: businessId,
      linkedId,
      type: data.type,
      date: data.date,
      description: data.description,
      source: data.source,
      category: data.category || '',
      amount: data.amount,
      currency: data.currency || 'XAF',
      amountXaf,
      reference: data.reference || '',
      shipmentId: data.shipmentId || '',
      products,
      auto: true
    },
    amountXaf
  };
}

function purchaseAmount(p) {
  if (p.purchaseValue > 0) return p.purchaseValue;
  const qty = Math.max(Number(p.quantity) || 1, 1);
  const price = Number(p.purchasePrice) || 0;
  return price * qty;
}

/** Cost basis for inventory added outside Purchases (warehouse / inventory add). */
function itemCogsAmount(item) {
  const unit = Number(item.purchasePrice) || 0;
  const value = Number(item.purchaseValue) || 0;
  if (value > 0) return value;
  if (unit > 0) {
    const qty = Math.max(Number(item.qty) || 1, 1);
    return unit * qty;
  }
  return 0;
}

function itemCogsLinkedId(item) {
  // Prefer Mongo _id — itemId can collide after transfer splits.
  const key = item._id ? String(item._id) : item.itemId || 'unknown';
  return `item-cogs-${key}`;
}

function parseItemPurchaseDate(item) {
  if (item.purchaseDate) {
    const d = new Date(item.purchaseDate);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return item.createdAt || new Date();
}

function queueUpsert(bulkOps, existing, businessId, linkedId, doc) {
  if (entryChanged(existing.get(linkedId), doc)) {
    bulkOps.push({
      updateOne: {
        filter: { business: businessId, linkedId },
        update: { $set: doc },
        upsert: true
      }
    });
  }
}

/**
 * Book inventory COGS without shrinking when on-hand qty falls after sales.
 * Increases when more cost is recorded on the same stock row.
 */
function queueItemCogsUpsert(bulkOps, existing, businessId, linkedId, doc) {
  const prev = existing.get(linkedId);
  if (prev && Number(prev.amount) > Number(doc.amount)) {
    doc.amount = prev.amount;
    doc.amountXaf = prev.amountXaf;
  }
  queueUpsert(bulkOps, existing, businessId, linkedId, doc);
}

/**
 * Partial transfers used to strip purchaseId from the moved clone, which made finance
 * re-book those units as Inventory COGS. Restore lineage from same-SKU purchase rows.
 */
async function backfillSourcedFromPurchaseIds(businessId) {
  const linked = await Item.find({
    business: businessId,
    purchaseId: { $nin: [null, ''] }
  })
    .select('sku purchaseId purchasePrice')
    .lean();
  if (!linked.length) return;

  const bySku = new Map();
  for (const row of linked) {
    const sku = String(row.sku || '').trim().toLowerCase();
    if (!sku || bySku.has(sku)) continue;
    bySku.set(sku, String(row.purchaseId));
  }

  const orphans = await Item.find({
    business: businessId,
    qty: { $gt: 0 },
    $and: [
      { $or: [{ purchaseId: { $exists: false } }, { purchaseId: null }, { purchaseId: '' }] },
      {
        $or: [
          { sourcedFromPurchaseId: { $exists: false } },
          { sourcedFromPurchaseId: null },
          { sourcedFromPurchaseId: '' }
        ]
      },
      { $or: [{ purchasePrice: { $gt: 0 } }, { purchaseValue: { $gt: 0 } }] }
    ]
  })
    .select('_id sku')
    .lean();

  const ops = [];
  for (const orphan of orphans) {
    const sku = String(orphan.sku || '').trim().toLowerCase();
    const purchaseId = bySku.get(sku);
    if (!purchaseId) continue;
    ops.push({
      updateOne: {
        filter: { _id: orphan._id },
        update: { $set: { sourcedFromPurchaseId: purchaseId } }
      }
    });
  }
  if (ops.length) await Item.bulkWrite(ops, { ordered: false });
}

/** Full sync — bulk upserts from all operational sources, prunes stale auto rows */
export async function syncFinanceLedger(businessId, generation = syncGeneration.get(String(businessId)) || 0) {
  const key = String(businessId);
  const stats = { pos: 0, sales: 0, purchases: 0, inventory: 0, shipments: 0, returns: 0, upserts: 0 };

  await backfillSourcedFromPurchaseIds(businessId);

  const [existingRows, txns, sales, purchases, shipments, returns, stockItems] = await Promise.all([
    FinanceEntry.find({ business: businessId, auto: true, linkedId: { $exists: true, $ne: '' } })
      .select('linkedId amount amountXaf description category date source products')
      .lean(),
    PosTransaction.find({ business: businessId, status: 'completed' })
      .select('transactionId date createdAt storeName total lines')
      .lean(),
    Sale.find({ business: businessId, status: 'completed' })
      .select('saleId createdAt source storeName total currency lines items')
      .lean(),
    Purchase.find({ business: businessId, status: 'saved' })
      .select('purchaseId purchaseDate createdAt itemName purchaseValue purchasePrice quantity')
      .lean(),
    Shipment.find({ business: businessId })
      .select('_id shipmentId goodsCost shippingCost dutiesCost salesRevenue updatedAt createdAt')
      .lean(),
    SalesReturn.find({ business: businessId, status: 'Completed' })
      .select('returnId originalTransactionId storeName refundAmount reason createdAt')
      .lean(),
    // Inventory/warehouse/bale stock with a cost, not already booked via a saved Purchase
    // (or a transfer split that still carries sourcedFromPurchaseId lineage).
    Item.find({
      business: businessId,
      $and: [
        { $or: [{ purchasePrice: { $gt: 0 } }, { purchaseValue: { $gt: 0 } }] },
        {
          $or: [
            { purchaseId: { $exists: false } },
            { purchaseId: null },
            { purchaseId: '' }
          ]
        },
        {
          $or: [{ purchase: { $exists: false } }, { purchase: null }]
        },
        {
          $or: [
            { sourcedFromPurchaseId: { $exists: false } },
            { sourcedFromPurchaseId: null },
            { sourcedFromPurchaseId: '' }
          ]
        }
      ]
    })
      .select('itemId name sku purchasePrice purchaseValue qty purchaseDate createdAt shipment')
      .lean()
  ]);

  const existing = new Map(existingRows.map((e) => [e.linkedId, e]));
  const bulkOps = [];
  const activeLinkedIds = new Set();
  const shipmentsWithGoodsCost = new Set(
    shipments.filter((s) => s.goodsCost > 0).map((s) => String(s._id))
  );

  for (const t of txns) {
    const linkedId = `pos-${t.transactionId}`;
    activeLinkedIds.add(linkedId);
    const products = productsFromLines(t.lines);
    const fallback = `POS sale · ${t.storeName || 'Store'}`;
    const { doc } = buildUpsert(businessId, linkedId, {
      type: 'revenue',
      date: t.date || t.createdAt,
      description: revenueDescriptionFromProducts(products, fallback),
      source: 'POS',
      amount: t.total,
      currency: 'XAF',
      reference: t.transactionId,
      products
    });
    queueUpsert(bulkOps, existing, businessId, linkedId, doc);
    stats.pos += 1;
  }

  for (const sale of sales) {
    if ((sale.source || 'POS') === 'POS') continue;
    const linkedId = `sale-${sale.saleId}`;
    activeLinkedIds.add(linkedId);
    const source = sale.source || 'Manual';
    const lines = sale.lines?.length ? sale.lines : sale.items || [];
    const products = productsFromLines(lines);
    const fallback = `${source} sale · ${sale.storeName || sale.saleId}`;
    const { doc } = buildUpsert(businessId, linkedId, {
      type: 'revenue',
      date: sale.createdAt,
      description: revenueDescriptionFromProducts(products, fallback),
      source,
      amount: sale.total,
      currency: sale.currency || 'XAF',
      reference: sale.saleId,
      products
    });
    queueUpsert(bulkOps, existing, businessId, linkedId, doc);
    stats.sales += 1;
  }

  for (const p of purchases) {
    const amount = purchaseAmount(p);
    if (!amount) continue;
    const linkedId = `purchase-${p.purchaseId}`;
    activeLinkedIds.add(linkedId);
    const { doc } = buildUpsert(businessId, linkedId, {
      type: 'expense',
      date: p.purchaseDate || p.createdAt,
      description: `Purchase: ${p.itemName || 'Goods'}`,
      source: 'Purchases',
      category: 'Goods / COGS',
      amount,
      currency: 'XAF',
      reference: p.purchaseId
    });
    queueUpsert(bulkOps, existing, businessId, linkedId, doc);
    stats.purchases += 1;
  }

  for (const item of stockItems) {
    // Shipment goodsCost already books COGS for cargo on that shipment
    if (item.shipment && shipmentsWithGoodsCost.has(String(item.shipment))) continue;
    const amount = itemCogsAmount(item);
    if (!amount) continue;
    const linkedId = itemCogsLinkedId(item);
    activeLinkedIds.add(linkedId);
    const ref = item.itemId || String(item._id);
    const { doc } = buildUpsert(businessId, linkedId, {
      type: 'expense',
      date: parseItemPurchaseDate(item),
      description: `Inventory: ${item.name || item.sku || 'Goods'}`,
      source: 'Inventory',
      category: 'Goods / COGS',
      amount,
      currency: 'XAF',
      reference: ref
    });
    queueItemCogsUpsert(bulkOps, existing, businessId, linkedId, doc);
    stats.inventory += 1;
  }

  for (const s of shipments) {
    const date = s.updatedAt || s.createdAt;
    const shipmentEntries = [];

    if (s.goodsCost > 0) {
      shipmentEntries.push(buildUpsert(businessId, `ship-goods-${s.shipmentId}`, {
        type: 'expense',
        date,
        description: `Shipment goods · ${s.shipmentId}`,
        source: 'Shipping',
        category: 'Goods / COGS',
        amount: s.goodsCost,
        currency: 'XAF',
        reference: s.shipmentId,
        shipmentId: s.shipmentId
      }));
    }
    if (s.shippingCost > 0) {
      shipmentEntries.push(buildUpsert(businessId, `ship-freight-${s.shipmentId}`, {
        type: 'expense',
        date,
        description: `Shipment freight · ${s.shipmentId}`,
        source: 'Shipping',
        category: 'Freight & Shipping',
        amount: s.shippingCost,
        currency: 'XAF',
        reference: s.shipmentId,
        shipmentId: s.shipmentId
      }));
    }
    if (s.dutiesCost > 0) {
      shipmentEntries.push(buildUpsert(businessId, `ship-duties-${s.shipmentId}`, {
        type: 'expense',
        date,
        description: `Customs duties · ${s.shipmentId}`,
        source: 'Shipping',
        category: 'Customs & Duties',
        amount: s.dutiesCost,
        currency: 'XAF',
        reference: s.shipmentId,
        shipmentId: s.shipmentId
      }));
    }
    if (s.salesRevenue > 0) {
      shipmentEntries.push(buildUpsert(businessId, `ship-sales-${s.shipmentId}`, {
        type: 'revenue',
        date,
        description: `Shipment sales · ${s.shipmentId}`,
        source: 'Shipment Sales',
        amount: s.salesRevenue,
        currency: 'XAF',
        reference: s.shipmentId,
        shipmentId: s.shipmentId
      }));
    }

    for (const { linkedId, doc } of shipmentEntries) {
      activeLinkedIds.add(linkedId);
      queueUpsert(bulkOps, existing, businessId, linkedId, doc);
      stats.shipments += 1;
    }
  }

  for (const r of returns) {
    if (!r.refundAmount) continue;
    const linkedId = `sales-return-${r.returnId}`;
    activeLinkedIds.add(linkedId);
    const { doc } = buildUpsert(businessId, linkedId, {
      type: 'expense',
      date: r.createdAt,
      description: `Store return ${r.returnId} · ${r.originalTransactionId}${r.reason ? ` — ${r.reason}` : ''}`,
      source: 'POS',
      category: 'Others (repairs, fees, misc.)',
      amount: r.refundAmount,
      currency: 'XAF',
      reference: r.returnId
    });
    queueUpsert(bulkOps, existing, businessId, linkedId, doc);
    stats.returns += 1;
  }

  if (bulkOps.length) {
    await FinanceEntry.bulkWrite(bulkOps, { ordered: false });
    stats.upserts = bulkOps.length;
  }

  if ((syncGeneration.get(key) || 0) !== generation) return stats;

  await refreshActiveLinkedIds(businessId, activeLinkedIds);

  if ((syncGeneration.get(key) || 0) !== generation) return stats;

  if (activeLinkedIds.size) {
    await FinanceEntry.deleteMany({
      business: businessId,
      auto: true,
      linkedId: { $exists: true, $ne: '', $nin: [...activeLinkedIds] }
    });
  }

  return stats;
}

export async function ensureFinanceSynced(businessId, { force = false, maxAgeMs = SYNC_TTL_MS } = {}) {
  const key = String(businessId);
  if (force) {
    syncCache.delete(key);
    inflight.delete(key);
  } else {
    const cached = syncCache.get(key);
    if (cached && Date.now() - cached.at < maxAgeMs) return cached.stats;
    if (inflight.has(key)) return inflight.get(key);
  }

  const generation = syncGeneration.get(key) || 0;
  const run = syncFinanceLedger(businessId, generation)
    .then((stats) => {
      if ((syncGeneration.get(key) || 0) === generation) {
        syncCache.set(key, { at: Date.now(), stats });
      }
      inflight.delete(key);
      return stats;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, run);
  return run;
}

export function invalidateFinanceSync(businessId) {
  const key = String(businessId);
  syncCache.delete(key);
  inflight.delete(key);
  syncGeneration.set(key, (syncGeneration.get(key) || 0) + 1);
}
