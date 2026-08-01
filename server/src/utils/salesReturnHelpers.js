import SalesReturn from '../models/SalesReturn.js';
import Item from '../models/Item.js';
import { loadStore, restoreInventory, itemBelongsToStore } from './posHelpers.js';

/** Cash and store credit only until Mobile Money / Card are launched. */
const REFUND_METHODS = ['Cash', 'Store Credit'];

export { REFUND_METHODS };

/** Generate return ID: RET-2026-001 (max sequence + 1 — safe after deletes) */
export async function nextSalesReturnId(businessId) {
  const year = new Date().getFullYear();
  const prefix = `RET-${year}-`;
  const rows = await SalesReturn.find({
    business: businessId,
    returnId: { $regex: `^${prefix}\\d+$` }
  })
    .select('returnId')
    .lean();

  let max = 0;
  for (const row of rows) {
    const n = parseInt(String(row.returnId).slice(prefix.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

export function formatSalesReturn(doc) {
  if (!doc) return null;
  const r = doc.toObject ? doc.toObject() : { ...doc };
  const itemCount = (r.items || []).reduce((s, i) => s + (i.quantityReturned || 0), 0);
  return {
    ...r,
    id: r.returnId,
    itemCount,
    itemsReturned: itemCount,
    processedBy: r.returnedByName || '—',
    date: r.createdAt
  };
}

/** How many units of a transaction line can still be returned */
export function lineReturnableQty(line) {
  const sold = line.qty || 0;
  const already = line.returnedQty || 0;
  return Math.max(0, sold - already);
}

/**
 * Validate return line picks against a POS transaction.
 * @param {object} txn - PosTransaction document
 * @param {Array<{sku?, productId?, qty}>} picks
 */
export function validateReturnPicks(txn, picks) {
  if (!picks?.length) {
    throw new Error('Select at least one item to return');
  }

  const normalized = [];
  for (const pick of picks) {
    const qty = Math.floor(Number(pick.qty) || 0);
    if (qty <= 0) continue;

    const line = (txn.lines || []).find(
      (l) =>
        (pick.productId && String(l.productId) === String(pick.productId)) ||
        (pick.sku && l.sku === pick.sku)
    );
    if (!line) {
      throw new Error(`Item not found on transaction: ${pick.sku || pick.productId}`);
    }

    const available = lineReturnableQty(line);
    if (qty > available) {
      throw new Error(
        `Cannot return ${qty} of "${line.name}" — only ${available} remaining (sold ${line.qty}, already returned ${line.returnedQty || 0})`
      );
    }

    normalized.push({
      productId: line.productId,
      sku: line.sku,
      name: line.name,
      quantityReturned: qty,
      unitPrice: line.price || 0,
      totalAmount: (line.price || 0) * qty,
      lineRef: line
    });
  }

  if (!normalized.length) {
    throw new Error('Select at least one item with quantity greater than zero');
  }

  return normalized;
}

/**
 * Put returned stock back on the store shelf (and total inventory qty).
 * Uses the same productId-first path as POS sales so the correct Item row is updated
 * and becomes visible again in store inventory + POS.
 */
export async function restoreInventoryForReturn(businessId, storeId, items) {
  const lines = (items || []).map((row) => ({
    productId: row.productId || row.itemId,
    itemId: row.itemId,
    sku: row.sku,
    quantityReturned: row.quantityReturned || row.qty || 0,
    name: row.name
  }));

  const restored = await restoreInventory(businessId, lines, storeId);

  for (const row of items || []) {
    const match = restored.find(
      (r) =>
        (row.productId && String(r.itemId) === String(row.productId)) ||
        (row.sku && r.sku === row.sku)
    );
    if (match) row.itemId = match.itemId;
  }

  const expected = lines.filter((l) => (l.quantityReturned || 0) > 0).length;
  if (expected > 0 && restored.length < expected) {
    const missing = lines
      .filter(
        (l) =>
          !restored.some(
            (r) =>
              (l.productId && String(r.itemId) === String(l.productId)) ||
              (l.sku && r.sku === l.sku)
          )
      )
      .map((l) => l.name || l.sku || l.productId)
      .join(', ');
    console.error('[sales-return] failed to restock:', missing);
    throw new Error(
      `Could not restore inventory for: ${missing}. The return was not completed — check that the sold items still exist.`
    );
  }

  return restored;
}

/** Undo inventory restock when a sales return is deleted */
export async function reverseInventoryForReturn(businessId, items, storeId) {
  const store = storeId ? await loadStore(businessId, storeId) : null;

  for (const row of items || []) {
    const qty = Math.max(0, Number(row.quantityReturned) || 0);
    if (!qty) continue;

    let item = null;
    const idHint = row.itemId || row.productId;
    if (idHint) {
      item = await Item.findOne({ business: businessId, _id: idHint });
    }
    if (!item && row.sku) {
      const matches = await Item.find({ business: businessId, sku: row.sku });
      item =
        (storeId && matches.find((m) => String(m.storeId) === String(storeId))) ||
        (storeId && matches.find((m) => itemBelongsToStore(m, storeId, store))) ||
        matches[0] ||
        null;
    }
    if (!item) {
      console.warn('[sales-return] reverse restock: item not found', row.sku || row.productId);
      continue;
    }

    item.qty = Math.max(0, (item.qty || 0) - qty);
    if (item.qty === 0) item.status = 'Sold';
    await item.save();
  }
}

function txnStatusAfterReturnChange(lines) {
  const hasReturns = (lines || []).some((l) => (l.returnedQty || 0) > 0);
  if (!hasReturns) return 'completed';
  const allFullyReturned = (lines || []).every((l) => lineReturnableQty(l) === 0);
  return allFullyReturned ? 'returned' : 'partially_returned';
}

export { txnStatusAfterReturnChange };
