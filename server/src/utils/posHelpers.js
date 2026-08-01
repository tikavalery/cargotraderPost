import Item from '../models/Item.js';
import PosTransaction from '../models/PosTransaction.js';
import Store from '../models/Store.js';

export const STORE_LOCATION_MAP = {
  'store-yde': ['Yaoundé', 'Yaoundé Hub', 'Yde', 'yde'],
  // Do not include "Douala Port" — that is a transit/shipping location, not shelf stock.
  'store-dla': ['Douala', 'dla'],
  'store-kri': ['Kribi', 'kri']
};

export const CATEGORY_LABELS = {
  Clothes: 'CLOTHES',
  Shoes: 'SHOES',
  Electronics: 'ELECTRONICS',
  Bags: 'BAGS',
  Accessories: 'ACCESSORIES'
};

export const FALLBACK_PRODUCTS = [
  { productId: 'fb-1', sku: 'CLT-1042', name: 'Vintage Denim Jacket', category: 'Clothes', price: 12000, qty: 8, icon: 'fa-vest', color: '#E85D26' },
  { productId: 'fb-2', sku: 'SHO-0887', name: 'Nike AF1 Sneakers', category: 'Shoes', price: 28000, qty: 4, icon: 'fa-shoe-prints', color: '#1A3C5E' },
  { productId: 'fb-3', sku: 'ELC-0588', name: 'Samsung Phone A52', category: 'Electronics', price: 95000, qty: 2, icon: 'fa-mobile-alt', color: '#27AE60' },
  { productId: 'fb-4', sku: 'BAG-0312', name: 'Leather Tote Bag', category: 'Bags', price: 18500, qty: 5, icon: 'fa-shopping-bag', color: '#9B59B6' },
  { productId: 'fb-5', sku: 'ELC-3301', name: 'Wireless Earbuds', category: 'Electronics', price: 22000, qty: 6, icon: 'fa-headphones', color: '#27AE60' },
  { productId: 'fb-6', sku: 'CLT-0777', name: 'Dashiki Print Top', category: 'Clothes', price: 7500, qty: 15, icon: 'fa-tshirt', color: '#E85D26' },
  { productId: 'fb-7', sku: 'SHO-0444', name: 'Nike Air Max', category: 'Shoes', price: 2500, qty: 1, icon: 'fa-shoe-prints', color: '#1A3C5E' }
];

export function matchesStoreLocation(location, storeId, storeDoc = null) {
  const tokens = locationTokensForStore(storeId, storeDoc);
  if (!tokens.length) return false;
  if (!location) return false;
  const loc = normalizeLocationToken(location);
  // Warehouse / depot stock must never count as store-shelf stock via city name overlap
  // (e.g. "Yaounde Warehouse" must not match store tokens containing "Yaoundé").
  if (/\b(warehouse|depot|entrepot|entrepôt)\b/i.test(location) || /\bwh[-_]?\b/i.test(loc)) {
    return false;
  }
  return tokens.some((t) => loc.includes(normalizeLocationToken(t)));
}

function normalizeLocationToken(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function locationTokensForStore(storeId, storeDoc = null) {
  const mapped = STORE_LOCATION_MAP[storeId] || [];
  const extra = storeDoc
    ? [storeDoc.locationToken, storeDoc.city, storeDoc.name].filter(Boolean)
    : [];
  // Never fall back to Yaoundé tokens for unknown store ids — that mis-tags other cities.
  return [...mapped, ...extra];
}

/** Location string written on items when transferring warehouse stock to a store. */
export function locationLabelForStore(store) {
  const s = store?.toObject ? store.toObject() : store;
  const city = s.city ? String(s.city).trim() : '';
  const name = s.name ? String(s.name).trim() : '';
  if (name && city) {
    // Avoid "Yaounde Store — Yaounde" duplication when the name already contains the city.
    const nameNorm = normalizeLocationToken(name);
    const cityNorm = normalizeLocationToken(city);
    if (nameNorm.includes(cityNorm) || cityNorm.includes(nameNorm)) return name;
    return `${name} — ${city}`;
  }
  if (s.locationToken) return String(s.locationToken).trim();
  if (city) return city;
  return name || 'Store';
}

/** Mongo filter for shelf stock at a specific store. */
export function storeItemFilter(storeId) {
  const sid = String(storeId);
  return {
    storeId: sid,
    status: 'In Store',
    qty: { $gt: 0 },
    $or: [{ warehouse: { $exists: false } }, { warehouse: null }]
  };
}

/** Whether a stock item is sellable at the given store (storeId is authoritative after transfer). */
export function itemBelongsToStore(item, storeId, storeDoc = null) {
  if (!item || !storeId) return false;
  if (item.warehouse) return false;
  if (item.status !== 'In Store') return false;
  if (item.qty <= 0) return false;
  if (item.storeId && String(item.storeId) === String(storeId)) return true;
  if (item.storeId) return false;
  return matchesStoreLocation(item.location, storeId, storeDoc);
}

export async function loadStore(businessId, storeId) {
  if (!storeId) return null;
  return Store.findOne({ business: businessId, storeId, active: { $ne: false } }).lean();
}

/** Backfill storeId on shelf items transferred before store tagging existed. */
async function reconcileStoreShelfItems(businessId) {
  const stores = await Store.find({ business: businessId, active: { $ne: false } }).lean();
  if (!stores.length) return;

  for (const store of stores) {
    const storeId = String(store.storeId);
    const label = locationLabelForStore(store);
    const locationMatch = {
      $or: [
        { location: label },
        { location: { $regex: String(store.name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
      ]
    };

    await Item.updateMany(
      {
        business: businessId,
        qty: { $gt: 0 },
        status: { $in: ['In Store', 'Stored'] },
        ...locationMatch,
        $or: [{ storeId: { $exists: false } }, { storeId: null }, { storeId: '' }]
      },
      {
        $set: { storeId, status: 'In Store' },
        $unset: { warehouse: '' }
      }
    );
  }

  const orphanCount = await Item.countDocuments({
    business: businessId,
    status: 'In Store',
    warehouse: null,
    qty: { $gt: 0 },
    $or: [{ storeId: { $exists: false } }, { storeId: null }, { storeId: '' }]
  });
  if (!orphanCount) return;

  const orphans = await Item.find({
    business: businessId,
    status: 'In Store',
    warehouse: null,
    qty: { $gt: 0 },
    $or: [{ storeId: { $exists: false } }, { storeId: null }, { storeId: '' }]
  })
    .select('_id location')
    .limit(200)
    .lean();

  for (const item of orphans) {
    const store = stores.find((s) => matchesStoreLocation(item.location, s.storeId, s));
    if (store) {
      await Item.updateOne(
        { _id: item._id },
        { $set: { storeId: store.storeId, status: 'In Store' }, $unset: { warehouse: '' } }
      );
    }
  }
}

export function mapItemToProduct(item) {
  const price =
    item.targetPrice ||
    item.priceXaf ||
    (item.qty > 0 && item.value ? Math.round(item.value / item.qty) : 0) ||
    item.purchasePrice ||
    0;
  return {
    productId: String(item._id),
    itemId: item.itemId,
    sku: item.sku,
    name: item.name,
    category: item.category || 'Clothes',
    catLabel: CATEGORY_LABELS[item.category] || String(item.category || 'ITEM').toUpperCase(),
    price,
    qty: item.qty,
    image: item.photos?.[0] || '',
    icon: item.icon || 'fa-box',
    color: item.color || '#8A97A8',
    lowStock: item.qty <= 3,
    outOfStock: item.qty <= 0
  };
}

export function mapFallbackProduct(p) {
  return {
    ...p,
    catLabel: CATEGORY_LABELS[p.category] || p.category.toUpperCase(),
    lowStock: p.qty <= 3,
    outOfStock: p.qty <= 0,
    image: ''
  };
}

export async function getStoreProducts(businessId, storeId, { category, search, inStockOnly = true } = {}) {
  if (!storeId) return [];

  const store = await loadStore(businessId, storeId);
  const sid = String(storeId);
  const qtyFilter = inStockOnly ? { $gt: 0 } : { $gte: 0 };

  const [taggedItems, legacyItems] = await Promise.all([
    Item.find({
      business: businessId,
      storeId: sid,
      status: 'In Store',
      warehouse: null,
      qty: qtyFilter
    }).lean(),
    Item.find({
      business: businessId,
      status: 'In Store',
      warehouse: null,
      qty: qtyFilter,
      $or: [{ storeId: { $exists: false } }, { storeId: null }, { storeId: '' }]
    }).lean()
  ]);

  const byId = new Map();
  for (const item of taggedItems) {
    byId.set(String(item._id), item);
  }
  for (const item of legacyItems) {
    if (!itemBelongsToStore(item, sid, store)) continue;
    byId.set(String(item._id), item);
  }

  let products = [...byId.values()].map(mapItemToProduct);

  if (category && category !== 'All') {
    products = products.filter((p) => p.category === category);
  }

  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    products = products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        String(p.productId).toLowerCase().includes(q)
    );
  }

  return products;
}

export async function getStoreInventoryItems(
  businessId,
  storeId,
  { category, search, inStockOnly = true } = {}
) {
  if (!storeId) return { items: [], summary: { itemsCount: 0, skuCount: 0, valueXaf: 0 } };

  const store = await loadStore(businessId, storeId);
  const sid = String(storeId);
  const qtyFilter = inStockOnly ? { $gt: 0 } : { $gte: 0 };

  const [taggedItems, legacyItems] = await Promise.all([
    Item.find({
      business: businessId,
      storeId: sid,
      status: 'In Store',
      warehouse: null,
      qty: qtyFilter
    })
      .sort({ name: 1 })
      .lean(),
    Item.find({
      business: businessId,
      status: 'In Store',
      warehouse: null,
      qty: qtyFilter,
      $or: [{ storeId: { $exists: false } }, { storeId: null }, { storeId: '' }]
    })
      .sort({ name: 1 })
      .lean()
  ]);

  const byId = new Map();
  for (const item of taggedItems) {
    byId.set(String(item._id), item);
  }
  for (const item of legacyItems) {
    if (!itemBelongsToStore(item, sid, store)) continue;
    byId.set(String(item._id), item);
  }

  let items = [...byId.values()];

  if (category && category !== 'All') {
    items = items.filter((i) => i.category === category);
  }

  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    items = items.filter(
      (i) =>
        i.name?.toLowerCase().includes(q) ||
        i.sku?.toLowerCase().includes(q) ||
        i.itemId?.toLowerCase().includes(q)
    );
  }

  const summary = items.reduce(
    (acc, item) => {
      acc.itemsCount += item.qty || 0;
      acc.skuCount += 1;
      acc.valueXaf +=
        item.value ||
        (item.targetPrice || item.priceXaf || 0) * (item.qty || 0);
      return acc;
    },
    { itemsCount: 0, skuCount: 0, valueXaf: 0 }
  );

  // Store shelf context: always present this store's label (never a leftover warehouse name).
  const storeLabel = store ? locationLabelForStore(store) : '';
  if (storeLabel) {
    const staleIds = items
      .filter((item) => item.location && item.location !== storeLabel)
      .map((item) => item._id)
      .filter(Boolean);
    if (staleIds.length) {
      Item.updateMany(
        { _id: { $in: staleIds }, business: businessId },
        { $set: { location: storeLabel } }
      ).catch(() => {});
    }
    items = items.map((item) => ({ ...item, location: storeLabel }));
  }

  return { items, summary };
}

export function parseScanCode(raw) {
  if (!raw) return null;
  const code = String(raw).trim();
  try {
    if (code.startsWith('{')) {
      const j = JSON.parse(code);
      return j.sku || j.id || j.productId || null;
    }
    if (code.includes('afritrade:item/')) {
      return code.split('afritrade:item/')[1]?.split(/[?#/]/)[0];
    }
    if (code.startsWith('http')) {
      const u = new URL(code);
      return u.searchParams.get('sku') || u.searchParams.get('id') || u.pathname.split('/').pop();
    }
  } catch {
    /* fall through */
  }
  return code;
}

export async function lookupProduct(businessId, storeId, code) {
  const parsed = parseScanCode(code);
  if (!parsed) return null;

  const store = await loadStore(businessId, storeId);

  // Prefer Mongo _id / itemId match so multi-location SKUs resolve correctly
  let item = null;
  if (/^[a-f\d]{24}$/i.test(parsed)) {
    item = await Item.findOne({ business: businessId, _id: parsed }).lean();
  }
  if (!item) {
    item = await Item.findOne({
      business: businessId,
      itemId: parsed
    }).lean();
  }
  if (!item) {
    const skuMatches = await Item.find({
      business: businessId,
      sku: parsed
    }).lean();
    item =
      skuMatches.find((row) => itemBelongsToStore(row, storeId, store) && row.qty > 0) ||
      skuMatches.find((row) => itemBelongsToStore(row, storeId, store)) ||
      null;
  }

  if (
    item &&
    itemBelongsToStore(item, storeId, store) &&
    item.qty > 0
  ) {
    return mapItemToProduct(item);
  }

  const products = await getStoreProducts(businessId, storeId, { inStockOnly: true });
  return (
    products.find(
      (p) =>
        p.sku.toLowerCase() === parsed.toLowerCase() ||
        String(p.productId).toLowerCase() === parsed.toLowerCase()
    ) || null
  );
}

export async function nextTransactionId(businessId) {
  const last = await PosTransaction.findOne({ business: businessId })
    .sort({ createdAt: -1 })
    .select('transactionId')
    .lean();
  let num = 0;
  if (last?.transactionId) {
    const m = last.transactionId.match(/TXN-(\d+)/);
    if (m) num = parseInt(m[1], 10);
  }
  return `TXN-${String(num + 1).padStart(4, '0')}`;
}

export function calcCartTotals(lines, discType = 'pct', discVal = 0, promoPct = 0) {
  const subtotal = (lines || []).reduce((s, l) => s + (l.price || 0) * (l.qty || 1), 0);
  let discount =
    discType === 'pct' ? Math.round(subtotal * (Number(discVal) || 0) / 100) : Math.min(subtotal, Number(discVal) || 0);
  if (promoPct > 0) {
    discount += Math.round((subtotal - discount) * promoPct / 100);
  }
  const total = Math.max(0, subtotal - discount);
  const itemCount = (lines || []).reduce((s, l) => s + (l.qty || 1), 0);
  return { subtotal, discount, tax: 0, total, itemCount };
}

export async function decrementInventory(businessId, lines) {
  for (const line of lines || []) {
    if (!line.sku && !line.productId) continue;
    const qty = line.qty || 1;
    let item = null;

    if (line.productId) {
      item = await Item.findOne({ business: businessId, _id: line.productId });
    }
    if (!item && line.sku) {
      const matches = await Item.find({ business: businessId, sku: line.sku, qty: { $gt: 0 } });
      item =
        matches.find((row) => row.status === 'In Store') ||
        matches[0] ||
        null;
    }
    if (!item) continue;

    item.qty = Math.max(0, item.qty - qty);
    if (item.qty === 0) item.status = 'Sold';
    await item.save();
  }
}

export async function restoreInventory(businessId, lines, storeId) {
  const store = storeId ? await loadStore(businessId, storeId) : null;
  const restored = [];

  for (const line of lines || []) {
    if (!line.sku && !line.productId && !line.itemId) continue;
    const qty = Math.max(0, Number(line.qty ?? line.quantityReturned) || 0);
    if (!qty) continue;

    let item = null;

    // Prefer the exact sold item (same as decrementInventory / POS cart productId)
    const idHint = line.productId || line.itemId;
    if (idHint) {
      item = await Item.findOne({ business: businessId, _id: idHint });
    }
    if (!item && line.sku && storeId) {
      const matches = await Item.find({ business: businessId, sku: line.sku });
      item =
        matches.find((row) => String(row.storeId) === String(storeId)) ||
        matches.find((row) => itemBelongsToStore(row, storeId, store)) ||
        matches.find((row) => ['In Store', 'Sold', 'Returned'].includes(row.status) && !row.warehouse) ||
        matches[0] ||
        null;
    } else if (!item && line.sku) {
      item = await Item.findOne({ business: businessId, sku: line.sku });
    }
    if (!item) continue;

    item.qty = (item.qty || 0) + qty;
    item.status = 'In Store';
    if (store) {
      item.storeId = String(storeId);
      // Must clear warehouse so POS / store inventory queries (warehouse: null) include this row
      item.warehouse = null;
      item.shipment = null;
      if (!item.location || item.location === 'Sold' || item.location === 'Returned') {
        item.location = store.name || store.storeId;
      }
    }
    await item.save();
    restored.push({ itemId: item._id, sku: item.sku, qty });
  }

  return restored;
}

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
