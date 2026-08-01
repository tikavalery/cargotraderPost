import Store, { StoreLog } from '../models/Store.js';
import PosTransaction from '../models/PosTransaction.js';
import HeldSale from '../models/HeldSale.js';
import RegisterSession from '../models/RegisterSession.js';
import PosCustomer from '../models/PosCustomer.js';
import FinanceEntry from '../models/FinanceEntry.js';
import SalesReturn from '../models/SalesReturn.js';
import { ensureFinanceSynced, invalidateFinanceSync } from '../services/financeSync.service.js';
import { toXaf } from '../utils/financeHelpers.js';
import PromoCode from '../models/PromoCode.js';
import ApiError, { asyncHandler } from '../utils/ApiError.js';
import {
  getStoreProducts,
  lookupProduct,
  nextTransactionId,
  calcCartTotals,
  decrementInventory,
  startOfToday
} from '../utils/posHelpers.js';
import {
  formatSalesReturn,
  lineReturnableQty,
  nextSalesReturnId,
  REFUND_METHODS,
  restoreInventoryForReturn,
  reverseInventoryForReturn,
  txnStatusAfterReturnChange,
  validateReturnPicks
} from '../utils/salesReturnHelpers.js';
import { assertClerkStoreAccess, clerkStoreFilter } from '../utils/clerkScope.js';
import { reconcileStoreAssignments } from '../utils/inventoryLocationHelpers.js';

export const getStoreProductsHandler = asyncHandler(async (req, res) => {
  const storeId = clerkStoreFilter(req, req.params.storeId);
  assertClerkStoreAccess(req, storeId);
  await reconcileStoreAssignments(req.businessId);
  const products = await getStoreProducts(req.businessId, storeId, {
    category: req.query.category,
    search: req.query.search,
    inStockOnly: req.query.inStockOnly !== 'false'
  });
  res.json({ ok: true, data: products, count: products.length });
});

export const lookupProductHandler = asyncHandler(async (req, res) => {
  const { code } = req.query;
  const storeId = clerkStoreFilter(req, req.query.storeId);
  if (!code || !storeId) throw new ApiError(400, 'code and storeId required');
  assertClerkStoreAccess(req, storeId);
  await reconcileStoreAssignments(req.businessId);
  const product = await lookupProduct(req.businessId, storeId, code);
  if (!product) throw new ApiError(404, 'Product not found');
  res.json({ ok: true, data: product });
});

export const listCustomers = asyncHandler(async (req, res) => {
  const customers = await PosCustomer.find({ business: req.businessId }).sort({ isWalkIn: -1, name: 1 }).lean();
  res.json({ ok: true, data: customers });
});

export const validatePromo = asyncHandler(async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  if (!code) throw new ApiError(400, 'Promo code required');
  const promo = await PromoCode.findOne({ business: req.businessId, code, active: true });
  if (!promo) return res.json({ ok: true, valid: false, message: 'Invalid promo code' });
  res.json({ ok: true, valid: true, discountPct: promo.discountPct, code: promo.code });
});

export const listTransactions = asyncHandler(async (req, res) => {
  const filter = {
    business: req.businessId,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }]
  };
  const storeId = clerkStoreFilter(req, req.query.storeId);
  if (storeId) filter.storeId = storeId;
  if (req.query.dateFrom || req.query.dateTo) {
    filter.date = {};
    if (req.query.dateFrom) filter.date.$gte = new Date(req.query.dateFrom);
    if (req.query.dateTo) filter.date.$lte = new Date(req.query.dateTo);
  }
  const limit = Math.min(Number(req.query.limit) || 100, 200);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    PosTransaction.find(filter).sort({ date: -1 }).skip(skip).limit(limit).lean(),
    PosTransaction.countDocuments(filter)
  ]);
  res.json({
    ok: true,
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit))
    }
  });
});

export const getTransaction = asyncHandler(async (req, res) => {
  const txn = await PosTransaction.findOne({
    business: req.businessId,
    transactionId: req.params.transactionId,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }]
  }).lean();
  if (!txn) throw new ApiError(404, 'Transaction not found');
  assertClerkStoreAccess(req, txn.storeId);
  res.json({ ok: true, data: txn });
});

export const createTransaction = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const storeId = clerkStoreFilter(req, body.storeId);
  if (!storeId) throw new ApiError(400, 'storeId required');
  assertClerkStoreAccess(req, storeId);
  body.storeId = storeId;

  const lines = body.lines || body.cart || [];
  if (!lines.length) throw new ApiError(400, 'Cart is empty');

  const promoPct = body.promoPct || 0;
  const totals = calcCartTotals(lines, body.discType, body.discVal, promoPct);
  const transactionId = await nextTransactionId(req.businessId);
  const store = await Store.findOne({ business: req.businessId, storeId: body.storeId }).lean();

  const txn = await PosTransaction.create({
    business: req.businessId,
    storeId: body.storeId,
    storeName: body.storeName || store?.name || 'Store',
    transactionId,
    customerName: body.customerName || 'Walk-in Customer',
    customerId: body.customerId,
    lines,
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total,
    itemCount: totals.itemCount,
    // Cash only until Mobile Money / Card POS are enabled in production
    payment: 'Cash',
    tendered: body.tendered || 0,
    change: Math.max(0, (body.tendered || 0) - totals.total),
    promoCode: body.promoCode,
    cashierId: req.userDoc._id,
    cashierName: req.userDoc.name || req.user.name,
    paymentStatus: 'paid'
  });

  await decrementInventory(req.businessId, lines);
  txn.inventoryFinalized = true;

  if (store?._id) {
    const cashier = req.userDoc.name || req.user.name || 'Cashier';
    const today = new Date().toISOString().slice(0, 10);
    const saleLogs = lines
      .map((line) => {
        const qty = Math.max(0, Number(line.qty) || 0);
        if (!qty) return null;
        const name = line.name || line.sku || 'Item';
        return {
          business: req.businessId,
          store: store._id,
          storeId: body.storeId,
          type: 'outbound',
          desc: `Sold ${qty}× ${name} · ${transactionId}`,
          date: today,
          user: cashier,
          source: 'POS Sale',
          qty,
          ago: 'just now'
        };
      })
      .filter(Boolean);
    if (saleLogs.length) {
      await StoreLog.insertMany(saleLogs);
    }
  }

  await FinanceEntry.create({
    business: req.businessId,
    type: 'revenue',
    date: txn.date || new Date(),
    source: 'POS',
    amount: totals.total,
    currency: 'XAF',
    amountXaf: toXaf(totals.total, 'XAF'),
    linkedId: `pos-${transactionId}`,
    description: `POS sale · ${store?.name || body.storeName || 'Store'}`,
    reference: transactionId,
    auto: true
  });
  await ensureFinanceSynced(req.businessId, { force: true });

  let register = await RegisterSession.findOne({
    business: req.businessId,
    storeId: body.storeId,
    open: true
  });
  if (!register) {
    register = await RegisterSession.create({
      business: req.businessId,
      storeId: body.storeId,
      cashierId: req.userDoc._id,
      open: true
    });
  }
  register.dayTotal += totals.total;
  register.transactionCount += 1;
  await register.save();

  res.status(201).json({
    ok: true,
    data: txn,
    transactionId,
    change: txn.change,
    receipt: { transactionId, total: txn.total, payment: txn.payment }
  });
});

export const listHeld = asyncHandler(async (req, res) => {
  const filter = { business: req.businessId };
  const storeId = clerkStoreFilter(req, req.query.storeId);
  if (storeId) filter.storeId = storeId;
  const data = await HeldSale.find(filter).sort({ createdAt: -1 }).lean();
  res.json({ ok: true, data });
});

export const createHeld = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const storeId = clerkStoreFilter(req, body.storeId);
  if (!storeId) throw new ApiError(400, 'storeId required');
  assertClerkStoreAccess(req, storeId);
  body.storeId = storeId;

  const lines = body.cart || body.lines || [];
  if (!lines.length) throw new ApiError(400, 'Cart is empty');

  const totals = calcCartTotals(lines, body.discType, body.discVal, body.promoPct || 0);
  const heldId = `HLD-${Date.now()}`;

  const held = await HeldSale.create({
    business: req.businessId,
    storeId: body.storeId,
    heldId,
    customerName: body.customerName || 'Walk-in Customer',
    cart: lines,
    subtotal: totals.subtotal,
    discount: totals.discount,
    total: totals.total,
    discType: body.discType || 'pct',
    discVal: body.discVal || 0,
    promoCode: body.promoCode,
    payment: body.payment
  });

  res.status(201).json({ ok: true, data: held });
});

export const resumeHeld = asyncHandler(async (req, res) => {
  const held = await HeldSale.findOne({
    business: req.businessId,
    heldId: req.params.heldId
  }).lean();
  if (!held) throw new ApiError(404, 'Held sale not found');
  assertClerkStoreAccess(req, held.storeId);
  res.json({ ok: true, data: held });
});

export const deleteHeld = asyncHandler(async (req, res) => {
  const held = await HeldSale.findOne({
    business: req.businessId,
    heldId: req.params.heldId
  }).lean();
  if (!held) throw new ApiError(404, 'Held sale not found');
  assertClerkStoreAccess(req, held.storeId);

  const result = await HeldSale.deleteOne({
    business: req.businessId,
    heldId: req.params.heldId
  });
  if (!result.deletedCount) throw new ApiError(404, 'Held sale not found');
  res.json({ ok: true, message: 'Held sale deleted' });
});

export const processReturn = asyncHandler(async (req, res) => {
  const { transactionId, reason, refundMethod, items, status = 'Completed' } = req.body || {};
  if (!transactionId) throw new ApiError(400, 'Transaction ID required');

  const txn = await PosTransaction.findOne({
    business: req.businessId,
    transactionId: String(transactionId).trim(),
    status: { $in: ['completed', 'partially_returned'] },
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }]
  });
  if (!txn) throw new ApiError(404, 'Transaction not found or already fully returned');
  assertClerkStoreAccess(req, txn.storeId);

  // Build return picks — full return if no items array provided (legacy flow)
  let picks = items;
  if (!picks?.length) {
    picks = (txn.lines || [])
      .map((line) => ({
        sku: line.sku,
        productId: line.productId,
        qty: lineReturnableQty(line)
      }))
      .filter((p) => p.qty > 0);
  }

  let validated;
  try {
    validated = validateReturnPicks(txn, picks);
  } catch (err) {
    throw new ApiError(400, err.message);
  }

  const refundAmount = validated.reduce((s, row) => s + row.totalAmount, 0);
  if (refundAmount <= 0) throw new ApiError(400, 'Nothing left to return on this transaction');

  const method = REFUND_METHODS.includes(refundMethod) ? refundMethod : txn.payment || 'Cash';
  const returnItems = validated.map(({ lineRef, ...row }) => row);
  const completed = status !== 'Pending';
  const previousStatus = txn.status;
  const previousRefundedTotal = txn.refundedTotal || 0;
  const previousReturnReason = txn.returnReason;
  const previousLineReturnedQty = (txn.lines || []).map((line) => line.returnedQty || 0);

  // Record the return + update the sale first so a later failure does not leave
  // restocked inventory while status stays "Completed".
  let returnId;
  let salesReturn;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    returnId = await nextSalesReturnId(req.businessId);
    try {
      salesReturn = await SalesReturn.create({
        business: req.businessId,
        returnId,
        originalTransactionId: txn.transactionId,
        posTransaction: txn._id,
        storeId: txn.storeId,
        storeName: txn.storeName,
        returnedBy: req.userDoc?._id,
        returnedByName: req.userDoc?.name || req.user?.name || 'Staff',
        refundMethod: method,
        refundAmount,
        reason: reason || '',
        status: completed ? 'Completed' : 'Pending',
        items: returnItems
      });
      break;
    } catch (err) {
      const isDup = err?.code === 11000 || err?.errorResponse?.code === 11000;
      if (!isDup || attempt === 4) throw err;
    }
  }

  for (const row of validated) {
    const line = row.lineRef;
    line.returnedQty = (line.returnedQty || 0) + row.quantityReturned;
  }
  txn.refundedTotal = previousRefundedTotal + refundAmount;
  const allReturned = (txn.lines || []).every((line) => lineReturnableQty(line) === 0);
  txn.status = allReturned ? 'returned' : 'partially_returned';
  if (reason) txn.returnReason = reason;
  txn.markModified('lines');
  await txn.save();

  const rollbackReturnRecord = async () => {
    await SalesReturn.deleteOne({ _id: salesReturn._id });
    (txn.lines || []).forEach((line, i) => {
      line.returnedQty = previousLineReturnedQty[i] || 0;
    });
    txn.refundedTotal = previousRefundedTotal;
    txn.status = previousStatus;
    txn.returnReason = previousReturnReason;
    txn.markModified('lines');
    await txn.save();
  };

  if (completed) {
    try {
      await restoreInventoryForReturn(req.businessId, txn.storeId, returnItems);
      if (salesReturn.items?.length) {
        salesReturn.items = returnItems;
        salesReturn.markModified('items');
        await salesReturn.save();
      }
    } catch (err) {
      await rollbackReturnRecord();
      throw new ApiError(400, err.message || 'Could not restore inventory for this return');
    }

    // Inbound: stock re-enters inventory from a completed sales return
    try {
      const storeDoc = await Store.findOne({
        business: req.businessId,
        storeId: txn.storeId
      }).lean();
      if (storeDoc?._id) {
        const today = new Date().toISOString().slice(0, 10);
        const userName = req.userDoc?.name || req.user?.name || 'Staff';
        const returnLogs = returnItems
          .map((row) => {
            const qty = Math.max(0, Number(row.quantityReturned) || 0);
            if (!qty) return null;
            const name = row.name || row.sku || 'Item';
            return {
              business: req.businessId,
              store: storeDoc._id,
              storeId: txn.storeId,
              type: 'inbound',
              desc: `Returned ${qty}× ${name} to inventory · ${returnId}${txn.transactionId ? ` (from ${txn.transactionId})` : ''}`,
              date: today,
              user: userName,
              source: 'Sales Return',
              qty,
              ago: 'just now'
            };
          })
          .filter(Boolean);
        if (returnLogs.length) await StoreLog.insertMany(returnLogs);
      }
    } catch (err) {
      console.error('[sales-return] activity log failed after successful return:', err.message);
    }

    try {
      await FinanceEntry.create({
        business: req.businessId,
        type: 'expense',
        date: new Date(),
        source: 'POS',
        category: 'Others (repairs, fees, misc.)',
        amount: refundAmount,
        currency: 'XAF',
        linkedId: `sales-return-${returnId}`,
        description: `Store return ${returnId} · ${txn.transactionId}${reason ? ` — ${reason}` : ''}`,
        reference: returnId,
        auto: true
      });
      invalidateFinanceSync(req.businessId);
    } catch (err) {
      console.error('[sales-return] finance entry failed after successful return:', err.message);
    }

    const register = await RegisterSession.findOne({
      business: req.businessId,
      storeId: txn.storeId,
      open: true
    });
    if (register) {
      register.dayTotal = Math.max(0, (register.dayTotal || 0) - refundAmount);
      await register.save();
    }
  }

  res.json({
    ok: true,
    data: formatSalesReturn(salesReturn),
    message: `Return ${returnId} processed for ${txn.transactionId}`
  });
});

export const listSalesReturns = asyncHandler(async (req, res) => {
  const filter = { business: req.businessId };
  const storeId = clerkStoreFilter(req, req.query.storeId);
  if (storeId) filter.storeId = storeId;
  if (req.query.transactionId) filter.originalTransactionId = req.query.transactionId;

  const limit = Math.min(Number(req.query.limit) || 100, 200);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    SalesReturn.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    SalesReturn.countDocuments(filter)
  ]);

  res.json({
    ok: true,
    data: data.map(formatSalesReturn),
    pagination: { page, limit, total }
  });
});

export const getSalesReturn = asyncHandler(async (req, res) => {
  const doc = await SalesReturn.findOne({
    business: req.businessId,
    returnId: req.params.returnId
  }).lean();
  if (!doc) throw new ApiError(404, 'Return not found');
  assertClerkStoreAccess(req, doc.storeId);
  res.json({ ok: true, data: formatSalesReturn(doc) });
});

export const deleteSalesReturn = asyncHandler(async (req, res) => {
  const salesReturn = await SalesReturn.findOne({
    business: req.businessId,
    returnId: req.params.returnId
  });
  if (!salesReturn) throw new ApiError(404, 'Return not found');
  assertClerkStoreAccess(req, salesReturn.storeId);

  const txn = await PosTransaction.findOne({
    business: req.businessId,
    transactionId: salesReturn.originalTransactionId
  });

  if (txn) {
    for (const row of salesReturn.items || []) {
      const line = (txn.lines || []).find(
        (l) =>
          (row.sku && l.sku === row.sku) ||
          (row.productId && String(l.productId) === String(row.productId))
      );
      if (line) {
        line.returnedQty = Math.max(0, (line.returnedQty || 0) - (row.quantityReturned || 0));
      }
    }
    txn.refundedTotal = Math.max(0, (txn.refundedTotal || 0) - (salesReturn.refundAmount || 0));
    txn.status = txnStatusAfterReturnChange(txn.lines);
    txn.markModified('lines');
    await txn.save();
  }

  if (salesReturn.status === 'Completed') {
    await reverseInventoryForReturn(req.businessId, salesReturn.items || [], salesReturn.storeId);

    // Outbound: undoing a return removes stock from inventory again
    try {
      const storeDoc = await Store.findOne({
        business: req.businessId,
        storeId: salesReturn.storeId
      }).lean();
      if (storeDoc?._id) {
        const today = new Date().toISOString().slice(0, 10);
        const userName = req.userDoc?.name || req.user?.name || 'Staff';
        const undoLogs = (salesReturn.items || [])
          .map((row) => {
            const qty = Math.max(0, Number(row.quantityReturned) || 0);
            if (!qty) return null;
            const name = row.name || row.sku || 'Item';
            return {
              business: req.businessId,
              store: storeDoc._id,
              storeId: salesReturn.storeId,
              type: 'outbound',
              desc: `Removed ${qty}× ${name} — sales return deleted (${salesReturn.returnId})`,
              date: today,
              user: userName,
              source: 'Sales Return',
              qty,
              ago: 'just now'
            };
          })
          .filter(Boolean);
        if (undoLogs.length) await StoreLog.insertMany(undoLogs);
      }
    } catch (err) {
      console.error('[sales-return] activity log failed after return delete:', err.message);
    }

    await FinanceEntry.deleteOne({
      business: req.businessId,
      linkedId: `sales-return-${salesReturn.returnId}`
    });
    invalidateFinanceSync(req.businessId);

    const register = await RegisterSession.findOne({
      business: req.businessId,
      storeId: salesReturn.storeId,
      open: true
    });
    if (register) {
      register.dayTotal = (register.dayTotal || 0) + (salesReturn.refundAmount || 0);
      await register.save();
    }
  }

  await salesReturn.deleteOne();
  res.json({ ok: true, message: `Return ${req.params.returnId} deleted` });
});

export const getReturnableTransaction = asyncHandler(async (req, res) => {
  const txn = await PosTransaction.findOne({
    business: req.businessId,
    transactionId: req.params.transactionId,
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }]
  }).lean();
  if (!txn) throw new ApiError(404, 'Transaction not found');
  assertClerkStoreAccess(req, txn.storeId);

  const lines = (txn.lines || []).map((line) => ({
    ...line,
    returnableQty: lineReturnableQty(line)
  }));

  res.json({
    ok: true,
    data: {
      ...txn,
      lines,
      canReturn: lines.some((l) => l.returnableQty > 0)
    }
  });
});

export const getRegister = asyncHandler(async (req, res) => {
  const storeId = clerkStoreFilter(req, req.query.storeId);
  if (!storeId) throw new ApiError(400, 'storeId required');
  assertClerkStoreAccess(req, storeId);

  let register = await RegisterSession.findOne({
    business: req.businessId,
    storeId,
    open: true
  }).lean();

  if (!register) {
    register = await RegisterSession.create({
      business: req.businessId,
      storeId,
      cashierId: req.userDoc._id,
      open: true
    });
    register = register.toObject();
  }

  res.json({ ok: true, data: register });
});

export const closeRegister = asyncHandler(async (req, res) => {
  const { dayTotal } = req.body || {};
  const storeId = clerkStoreFilter(req, req.body?.storeId);
  if (!storeId) throw new ApiError(400, 'storeId required');
  assertClerkStoreAccess(req, storeId);

  const register = await RegisterSession.findOne({
    business: req.businessId,
    storeId,
    open: true
  });
  if (!register) throw new ApiError(404, 'No open register session');

  register.open = false;
  register.closedAt = new Date();
  if (dayTotal != null) register.dayTotal = dayTotal;
  await register.save();

  res.json({ ok: true, data: register, message: 'Register closed' });
});

export const todayStats = asyncHandler(async (req, res) => {
  const storeId = clerkStoreFilter(req, req.query.storeId);
  const today = startOfToday();
  const filter = {
    business: req.businessId,
    status: 'completed',
    date: { $gte: today },
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }]
  };
  if (storeId) filter.storeId = storeId;

  const txns = await PosTransaction.find(filter).lean();
  const total = txns.reduce((s, t) => s + t.total, 0);
  const units = txns.reduce((s, t) => s + (t.itemCount || 0), 0);
  const count = txns.length;

  res.json({
    ok: true,
    data: { count, total, avg: count ? Math.round(total / count) : 0, units }
  });
});
