import { categoryMeta, syncItemPricing } from '../constants/inventory.js';
import Item from '../models/Item.js';
import Bale from '../models/Bale.js';
import { locationLabelForStore } from './posHelpers.js';

export const CAT_PREFIX = {
  Clothes: 'CLT',
  Shoes: 'SHO',
  Electronics: 'ELC',
  Bags: 'BAG',
  Accessories: 'ACC'
};

export function baleItemQty(bi) {
  const q = parseInt(bi?.qty, 10);
  return Number.isNaN(q) || q < 1 ? 1 : q;
}

export function activeBaleItems(bale) {
  return (bale.items || []).filter((bi) => !bi.returned);
}

export function returnedBaleItems(bale) {
  return (bale.items || []).filter((bi) => bi.returned);
}

export function baleActiveUnits(bale) {
  if (!bale) return 0;
  const lines = bale.items || [];
  if (lines.length) {
    return activeBaleItems(bale).reduce((sum, bi) => sum + baleItemQty(bi), 0);
  }
  const stored = Number(bale.itemCount ?? bale.totalUnits);
  return Number.isFinite(stored) && stored > 0 ? stored : 0;
}

export function baleItemStockSku(bi) {
  const sub = (bi?.subtitle || '').trim();
  if (!sub) return bi?.sku || '';
  const unitIdx = sub.indexOf(' · unit ');
  if (unitIdx >= 0) return sub.slice(0, unitIdx);
  return sub.split(' · ')[0] || sub;
}

/** Unique POS SKU for a line unpacked from a grouped item. */
export function shelfSkuForBaleLine(bale, line) {
  const fromLine = (baleItemStockSku(line) || line.sku || '').trim();
  if (fromLine && fromLine.includes('-')) return fromLine;
  const base = (bale.sku || bale.baleId || 'GRP').trim();
  return `${base}-${line.id}`;
}

async function nextShelfItemId(businessId, session) {
  const q = Item.countDocuments({ business: businessId });
  const count = session ? await q.session(session) : await q;
  return `ITM-${String(count + 1).padStart(3, '0')}`;
}

export function baleItemMatchKey(bi) {
  return [
    (bi.name || '').toLowerCase(),
    (bi.category || '').toLowerCase(),
    baleItemStockSku(bi).toLowerCase(),
    String(bi.priceXaf || bi.targetPrice || 0),
    bi.grade || 'B',
    (bi.condition || '').toLowerCase(),
    bi.returned ? 'returned' : 'active'
  ].join('|');
}

export function consolidateBaleItems(bale) {
  if (!bale?.items?.length) return bale;
  const grouped = {};
  const order = [];
  bale.items.forEach((bi) => {
    const key = baleItemMatchKey(bi);
    if (!grouped[key]) {
      grouped[key] = { ...bi, qty: baleItemQty(bi) };
      order.push(key);
    } else {
      grouped[key].qty = baleItemQty(grouped[key]) + baleItemQty(bi);
    }
  });
  bale.items = order.map((key) => grouped[key]);
  return bale;
}

export function findMatchingBaleItem(bale, candidate) {
  const key = baleItemMatchKey(candidate);
  return (bale.items || []).find((bi) => !bi.returned && baleItemMatchKey(bi) === key) || null;
}

export function recalcBale(bale) {
  consolidateBaleItems(bale);
  const items = activeBaleItems(bale);
  bale.itemCount = items.reduce((sum, it) => sum + baleItemQty(it), 0);
  bale.totalUnits = bale.itemCount;
  const sellTotal = items.reduce(
    (s, it) => s + (it.priceXaf || it.targetPrice || 0) * baleItemQty(it),
    0
  );
  if (sellTotal > 0) bale.value = sellTotal;
  return bale;
}

export function generateBaleSku(category, existingBales = []) {
  const prefix = CAT_PREFIX[category] || 'GEN';
  const count =
    existingBales.filter((b) => b.sku && b.sku.startsWith(`${prefix}-`)).length + 1;
  return `${prefix}-BALE-${String(count).padStart(3, '0')}`;
}

export function nextBaleItemId(bale) {
  const items = bale.items || [];
  if (!items.length) return '001';
  const max = items.reduce((m, it) => {
    const n = parseInt(it.id, 10);
    return Number.isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return String(max + 1).padStart(3, '0');
}

export async function nextBaleHumanId(Bale, businessId) {
  const count = await Bale.countDocuments({ business: businessId });
  return `BALE-${String(count + 1).padStart(3, '0')}`;
}

export function applyBaleCategoryDefaults(bale) {
  const meta = categoryMeta(bale.category);
  bale.icon = meta.icon;
  bale.color = meta.color;
  bale.type = 'Grouped Item';
  return bale;
}

export function baleLineAsStockRow(line, bale) {
  const meta = categoryMeta(line.category);
  return {
    id: line.id,
    name: line.name,
    sku: baleItemStockSku(line) || `${bale.sku}-${line.id}`,
    category: line.category,
    qty: baleItemQty(line),
    location: bale.location,
    purchasePrice: line.purchasePrice || 0,
    targetPrice: line.targetPrice || line.priceXaf || 0,
    purchaseDate: line.purchaseDate || '—',
    status: line.returned ? 'Returned' : 'Stored',
    icon: line.icon || meta.icon,
    color: line.color || meta.color,
    returned: line.returned
  };
}

export function baleListQuery(businessId, { search, category, location } = {}) {
  const filter = { business: businessId };
  if (category) filter.category = category;
  if (location) {
    const q = location.trim();
    filter.location = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }
  if (search) {
    const q = search.trim();
    filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { sku: { $regex: q, $options: 'i' } },
      { baleId: { $regex: q, $options: 'i' } }
    ];
  }
  return filter;
}

/**
 * Unpack all active lines in a grouped item onto store shelf stock (POS-sellable Item docs).
 * Removes the bale after a successful unpack.
 */
export async function unpackBaleToStore({ businessId, bale, store, userId, session = null }) {
  const q = Bale.findOne({ _id: bale._id, business: businessId });
  const fullBale = bale.items?.length ? bale : session ? await q.session(session) : await q;
  if (!fullBale?.items?.length) {
    throw new Error('Grouped item has no lines to send to store');
  }

  const toLocation = locationLabelForStore(store);
  const storeId = String(store.storeId);
  const created = [];
  let totalUnits = 0;

  for (const line of activeBaleItems(fullBale)) {
    const moveQty = baleItemQty(line);
    const unitVal = line.targetPrice || line.priceXaf || 0;
    const unitCost = line.purchasePrice || 0;
    const shelfSku = shelfSkuForBaleLine(fullBale, line);

    const findQ = Item.findOne({
      business: businessId,
      sku: shelfSku,
      status: { $ne: 'Sold' },
      $or: [{ bale: null }, { bale: { $exists: false } }]
    });
    let stock = session ? await findQ.session(session) : await findQ;

    if (stock) {
      stock.qty += moveQty;
      stock.targetPrice = unitVal || stock.targetPrice;
      stock.purchasePrice = unitCost || stock.purchasePrice;
      stock.location = toLocation;
      stock.status = 'In Store';
      stock.storeId = storeId;
      stock.warehouse = undefined;
      stock.name = line.name || stock.name;
      stock.category = line.category || stock.category;
      if (line.icon) stock.icon = line.icon;
      if (line.color) stock.color = line.color;
      if (line.photos?.length) stock.photos = line.photos;
      syncItemPricing(stock);
      await stock.save({ session });
    } else {
      const meta = categoryMeta(line.category);
      const itemData = {
        business: businessId,
        itemId: await nextShelfItemId(businessId, session),
        name: line.name,
        sku: shelfSku,
        category: line.category,
        qty: moveQty,
        reorder: 5,
        location: toLocation,
        storeId,
        status: 'In Store',
        targetPrice: unitVal,
        purchasePrice: unitCost,
        icon: line.icon || meta.icon,
        color: line.color || meta.color,
        photos: line.photos || [],
        createdBy: userId
      };
      syncItemPricing(itemData);
      const createOpts = session ? { session } : {};
      const [doc] = await Item.create([itemData], createOpts);
      stock = doc;
    }

    created.push(stock);
    totalUnits += moveQty;
  }

  const delQ = Bale.deleteOne({ _id: fullBale._id, business: businessId });
  if (session) await delQ.session(session);
  else await delQ;

  return { totalUnits, items: created, baleName: fullBale.name };
}

export function filterBales(bales, { search, category, location } = {}) {
  let list = [...bales];
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(
      (b) =>
        (b.name || '').toLowerCase().includes(q) ||
        (b.sku || '').toLowerCase().includes(q) ||
        (b.baleId || '').toLowerCase().includes(q)
    );
  }
  if (category) list = list.filter((b) => b.category === category);
  if (location) list = list.filter((b) => b.location === location);
  return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}
