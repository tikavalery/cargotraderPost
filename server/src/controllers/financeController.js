import { isValidId } from '../utils/ids.js';
import FinanceEntry from '../models/FinanceEntry.js';
import ApiError, { asyncHandler } from '../utils/ApiError.js';
import { RATE_DISPLAY, EXPENSE_CATEGORIES, REVENUE_SOURCES } from '../constants/financeConstants.js';
import { convertAmount, toXaf, fmtCurrency } from '../utils/financeHelpers.js';
import { parseFinancePagination } from '../utils/tokens.js';
import { VALID_CURRENCIES } from '../constants/currencies.js';
import { revenueDescriptionFromProducts } from '../utils/financeProductHelpers.js';
import { ensureFinanceSynced, invalidateFinanceSync, syncFinanceLedger } from '../services/financeSync.service.js';
import { ensureCloudPhotos } from '../utils/ensureCloudPhotos.js';
import { analyzeExpenseImageFromDataUrl } from '../services/expenseImageAnalysis.service.js';
import {
  assertAiAnalysisAvailable,
  recordAiAnalysisUse,
  getBusinessSubscription
} from '../services/subscriptionService.js';
import { getPlanLimit } from '../constants/plans.js';
import {
  getDashboard,
  getRevenueOverview,
  getRevenueSummary,
  getRevenueTrend,
  getRevenueSales,
  getExpenseSummary,
  getExpensesOverview,
  getExpenseTrend,
  getExpenseList,
  getCashFlow,
  getCashFlowPage,
  getExpenseInsights,
  getRevenueCategories,
  getRevenueWarehouses,
  getExpenseCategoriesTable,
  enrichRevenueEntry,
  plByShipment,
  getProfitLossPage,
  calcLandedCost
} from '../services/financeAggregation.service.js';

export const sync = asyncHandler(async (req, res) => {
  invalidateFinanceSync(req.businessId);
  const stats = await ensureFinanceSynced(req.businessId, { force: true });
  res.json({ ok: true, stats });
});

export const dashboard = asyncHandler(async (req, res) => {
  const data = await getDashboard(req.businessId, {
    period: req.query.period || 'month',
    currency: req.query.currency || 'USD'
  });
  res.json({ ok: true, data });
});

export const revenueOverview = asyncHandler(async (req, res) => {
  const { page, pageSize } = parseFinancePagination(req.query);
  const data = await getRevenueOverview(req.businessId, {
    range: req.query.range || 'month',
    currency: req.query.currency || 'USD',
    page,
    pageSize
  });
  res.json({ ok: true, data });
});

export const revenueSummary = asyncHandler(async (req, res) => {
  const data = await getRevenueSummary(req.businessId, {
    range: req.query.range || 'month',
    currency: req.query.currency || 'USD'
  });
  res.json({ ok: true, data });
});

export const revenueTrend = asyncHandler(async (req, res) => {
  const data = await getRevenueTrend(req.businessId, req.query.range || 'month');
  res.json({ ok: true, data });
});

export const revenueChannels = asyncHandler(async (req, res) => {
  const summary = await getRevenueSummary(req.businessId, { range: req.query.range || 'month' });
  res.json({ ok: true, data: summary.bySource });
});

export const revenueSales = asyncHandler(async (req, res) => {
  const { page, pageSize } = parseFinancePagination(req.query);
  const data = await getRevenueSales(req.businessId, {
    range: req.query.range || 'month',
    page,
    pageSize,
    source: req.query.source || 'all',
    search: req.query.search || ''
  });
  res.json({ ok: true, ...data });
});

export const revenueCategories = asyncHandler(async (req, res) => {
  const data = await getRevenueCategories(req.businessId, req.query.range || 'month', req.query.currency || 'USD');
  res.json({ ok: true, data });
});

export const revenueWarehouses = asyncHandler(async (req, res) => {
  const data = await getRevenueWarehouses(req.businessId, req.query.range || 'month', req.query.currency || 'USD');
  res.json({ ok: true, data });
});

export const createRevenue = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, 'Amount must be greater than zero');
  }
  if (!body.description?.trim()) {
    throw new ApiError(400, 'Description is required');
  }

  const source = body.source || 'Manual';
  if (!REVENUE_SOURCES.includes(source)) {
    throw new ApiError(400, 'Invalid revenue source');
  }

  const currency = VALID_CURRENCIES.includes(body.currency) ? body.currency : 'XAF';
  const date = body.date ? new Date(body.date) : new Date();
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, 'Invalid date');
  }

  const entry = await FinanceEntry.create({
    business: req.businessId,
    type: 'revenue',
    date,
    description: body.description.trim(),
    source,
    amount,
    currency,
    reference: (body.reference || '').trim(),
    auto: false
  });

  invalidateFinanceSync(req.businessId);
  res.status(201).json({
    ok: true,
    message: 'Revenue recorded',
    data: {
      id: entry.entryId || String(entry._id),
      date: entry.date,
      source: entry.source,
      description: entry.description,
      amount: entry.amount,
      currency: entry.currency,
      amountXaf: entry.amountXaf,
      reference: entry.reference,
      auto: entry.auto
    }
  });
});

function formatRevenueEntry(entry) {
  const e = entry.toObject ? entry.toObject() : entry;
  const products = e.products || [];
  const description = products.length
    ? revenueDescriptionFromProducts(products, e.description)
    : e.description;
  return {
    id: e.entryId || String(e._id),
    date: e.date,
    source: e.source,
    description,
    products,
    amount: e.amount,
    currency: e.currency || 'XAF',
    amountXaf: e.amountXaf,
    reference: e.reference || '',
    status: e.auto ? 'Synced' : 'Recorded',
    auto: Boolean(e.auto)
  };
}

function financeEntryIdFilter(id) {
  const clauses = [{ entryId: id }];
  if (id && isValidId(id)) clauses.push({ _id: id });
  return { $or: clauses };
}

async function findFinanceEntry(businessId, id) {
  return FinanceEntry.findOne({
    business: businessId,
    ...financeEntryIdFilter(id)
  });
}

async function findExpenseEntry(businessId, id) {
  return FinanceEntry.findOne({
    business: businessId,
    ...financeEntryIdFilter(id),
    type: 'expense'
  });
}

function formatExpenseEntry(entry) {
  const e = entry.toObject ? entry.toObject() : entry;
  const receipts = Array.isArray(e.receipts) ? e.receipts.filter(Boolean) : [];
  return {
    id: e.entryId || String(e._id),
    date: e.date,
    category: e.category || 'Other',
    description: e.description,
    amount: e.amount,
    currency: e.currency || 'XAF',
    amountXaf: e.amountXaf,
    reference: e.reference || '',
    shipmentId: e.shipmentId || '',
    relatedTo: e.shipmentId || e.reference || '—',
    source: e.source || 'Manual',
    status: e.auto ? 'Synced' : 'Recorded',
    auto: Boolean(e.auto),
    receipts
  };
}

function formatCashFlowEntry(entry, currency = 'USD') {
  const e = entry.toObject ? entry.toObject() : entry;
  const base = e.type === 'revenue' ? formatRevenueEntry(entry) : formatExpenseEntry(entry);
  return {
    ...base,
    type: e.type,
    category: e.category || (e.type === 'revenue' ? 'Revenue' : '—'),
    amountFmt: fmtCurrency(currency, e.amountXaf)
  };
}

async function findRevenueEntry(businessId, id) {
  return FinanceEntry.findOne({
    business: businessId,
    ...financeEntryIdFilter(id),
    type: 'revenue'
  });
}

export const getRevenue = asyncHandler(async (req, res) => {
  const entry = await findRevenueEntry(req.businessId, req.params.id);
  if (!entry) throw new ApiError(404, 'Entry not found');
  const enriched = await enrichRevenueEntry(req.businessId, entry);
  res.json({ ok: true, data: formatRevenueEntry(enriched) });
});

export const updateRevenue = asyncHandler(async (req, res) => {
  const entry = await findRevenueEntry(req.businessId, req.params.id);
  if (!entry) throw new ApiError(404, 'Entry not found');
  if (entry.auto) throw new ApiError(403, 'Cannot edit auto-synced entry');

  const body = req.body || {};
  const amount = Number(body.amount ?? entry.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, 'Amount must be greater than zero');
  }
  const description = (body.description ?? entry.description)?.trim();
  if (!description) throw new ApiError(400, 'Description is required');

  const source = body.source ?? entry.source;
  if (!REVENUE_SOURCES.includes(source)) {
    throw new ApiError(400, 'Invalid revenue source');
  }

  const currency = VALID_CURRENCIES.includes(body.currency) ? body.currency : entry.currency;
  const date = body.date ? new Date(body.date) : entry.date;
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, 'Invalid date');
  }

  entry.date = date;
  entry.source = source;
  entry.description = description;
  entry.amount = amount;
  entry.currency = currency;
  entry.reference = (body.reference ?? entry.reference ?? '').trim();
  await entry.save();

  invalidateFinanceSync(req.businessId);
  res.json({ ok: true, message: 'Revenue updated', data: formatRevenueEntry(entry) });
});

export const deleteRevenue = asyncHandler(async (req, res) => {
  const entry = await findRevenueEntry(req.businessId, req.params.id);
  if (!entry) throw new ApiError(404, 'Entry not found');
  if (entry.auto) throw new ApiError(403, 'Cannot delete auto-synced entry');
  await entry.deleteOne();
  invalidateFinanceSync(req.businessId);
  res.json({ ok: true, message: 'Deleted' });
});

export const expensesOverview = asyncHandler(async (req, res) => {
  const { page, pageSize } = parseFinancePagination(req.query);
  const data = await getExpensesOverview(req.businessId, {
    range: req.query.range || 'month',
    currency: req.query.currency || 'USD',
    page,
    pageSize
  });
  res.json({ ok: true, data });
});

export const expensesSummary = asyncHandler(async (req, res) => {
  const data = await getExpenseSummary(req.businessId, {
    range: req.query.range || 'month',
    currency: req.query.currency || 'USD'
  });
  res.json({ ok: true, data });
});

export const expensesCategories = asyncHandler(async (req, res) => {
  const data = await getExpenseCategoriesTable(req.businessId, req.query.range || 'month', req.query.currency || 'USD');
  res.json({ ok: true, data });
});

export const expensesTrend = asyncHandler(async (req, res) => {
  const data = await getExpenseTrend(req.businessId);
  res.json({ ok: true, data });
});

export const expensesList = asyncHandler(async (req, res) => {
  const { page, pageSize } = parseFinancePagination(req.query);
  const data = await getExpenseList(req.businessId, {
    range: req.query.range || 'month',
    page,
    pageSize,
    category: req.query.category || 'all',
    search: req.query.search || ''
  });
  res.json({ ok: true, ...data });
});

export const expensesInsights = asyncHandler(async (req, res) => {
  const data = await getExpenseInsights(req.businessId, req.query.range || 'month');
  res.json({ ok: true, data });
});

/** AI vision — extract expense fields from a receipt / invoice photo */
export const analyzeExpenseImage = asyncHandler(async (req, res) => {
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
    const data = await analyzeExpenseImageFromDataUrl(image);
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

export const createExpense = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, 'Amount must be greater than zero');
  }
  if (!body.description?.trim()) {
    throw new ApiError(400, 'Description is required');
  }

  const category = body.category || 'Salaries & Wages';
  if (!EXPENSE_CATEGORIES.includes(category)) {
    throw new ApiError(400, 'Invalid expense category');
  }

  const currency = VALID_CURRENCIES.includes(body.currency) ? body.currency : 'XAF';
  const date = body.date ? new Date(body.date) : new Date();
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, 'Invalid date');
  }

  const receipts = await ensureCloudPhotos(
    Array.isArray(body.receipts) ? body.receipts.slice(0, 8) : [],
    { businessId: req.businessId, folderSuffix: 'expense-receipts' }
  );

  const entry = await FinanceEntry.create({
    business: req.businessId,
    type: 'expense',
    date,
    description: body.description.trim(),
    source: body.source || 'Manual',
    category,
    amount,
    currency,
    reference: (body.reference || '').trim(),
    shipmentId: (body.shipmentId || '').trim(),
    receipts,
    auto: false
  });

  invalidateFinanceSync(req.businessId);
  res.status(201).json({
    ok: true,
    message: 'Expense recorded',
    data: formatExpenseEntry(entry)
  });
});

export const getExpense = asyncHandler(async (req, res) => {
  const entry = await findExpenseEntry(req.businessId, req.params.id);
  if (!entry) throw new ApiError(404, 'Entry not found');
  res.json({ ok: true, data: formatExpenseEntry(entry) });
});

export const updateExpense = asyncHandler(async (req, res) => {
  const entry = await findExpenseEntry(req.businessId, req.params.id);
  if (!entry) throw new ApiError(404, 'Entry not found');
  if (entry.auto) throw new ApiError(403, 'Cannot edit auto-synced entry');

  const body = req.body || {};
  const amount = Number(body.amount ?? entry.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ApiError(400, 'Amount must be greater than zero');
  }
  const description = (body.description ?? entry.description)?.trim();
  if (!description) throw new ApiError(400, 'Description is required');

  const category = body.category ?? entry.category;
  if (!EXPENSE_CATEGORIES.includes(category)) {
    throw new ApiError(400, 'Invalid expense category');
  }

  const currency = VALID_CURRENCIES.includes(body.currency) ? body.currency : entry.currency;
  const date = body.date ? new Date(body.date) : entry.date;
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, 'Invalid date');
  }

  entry.date = date;
  entry.category = category;
  entry.description = description;
  entry.amount = amount;
  entry.currency = currency;
  entry.reference = (body.reference ?? entry.reference ?? '').trim();
  entry.shipmentId = (body.shipmentId ?? entry.shipmentId ?? '').trim();
  if (body.receipts !== undefined) {
    entry.receipts = await ensureCloudPhotos(
      Array.isArray(body.receipts) ? body.receipts.slice(0, 8) : [],
      { businessId: req.businessId, folderSuffix: 'expense-receipts' }
    );
  }
  await entry.save();

  invalidateFinanceSync(req.businessId);
  res.json({ ok: true, message: 'Expense updated', data: formatExpenseEntry(entry) });
});

export const deleteExpense = asyncHandler(async (req, res) => {
  const entry = await findExpenseEntry(req.businessId, req.params.id);
  if (!entry) throw new ApiError(404, 'Entry not found');
  if (entry.auto) throw new ApiError(403, 'Cannot delete auto-synced entry');
  await entry.deleteOne();
  invalidateFinanceSync(req.businessId);
  res.json({ ok: true, message: 'Deleted' });
});

export const cashFlow = asyncHandler(async (req, res) => {
  const currency = req.query.currency || 'XAF';
  const range = req.query.range || 'month';
  const { page, pageSize } = parseFinancePagination(req.query);
  const data = await getCashFlowPage(req.businessId, {
    currency,
    range,
    page,
    pageSize,
    tab: req.query.tab || 'all'
  });
  res.json({ ok: true, data });
});

export const getCashFlowEntry = asyncHandler(async (req, res) => {
  const entry = await findFinanceEntry(req.businessId, req.params.id);
  if (!entry) throw new ApiError(404, 'Entry not found');
  res.json({
    ok: true,
    data: formatCashFlowEntry(entry, req.query.currency || 'USD')
  });
});

export const deleteCashFlowEntry = asyncHandler(async (req, res) => {
  const entry = await findFinanceEntry(req.businessId, req.params.id);
  if (!entry) throw new ApiError(404, 'Entry not found');
  if (entry.auto) throw new ApiError(403, 'Cannot delete auto-synced entry');
  await entry.deleteOne();
  invalidateFinanceSync(req.businessId);
  res.json({ ok: true, message: 'Deleted' });
});

export const exchangeRates = asyncHandler(async (req, res) => {
  res.json({ ok: true, data: RATE_DISPLAY });
});

export const convertRate = asyncHandler(async (req, res) => {
  const { amount = 100, from = 'USD', to = 'XAF' } = req.body || {};
  const result = convertAmount(amount, from, to);
  res.json({ ok: true, data: { amount: Number(amount), from, to, result } });
});

export const profitLoss = asyncHandler(async (req, res) => {
  const currency = req.query.currency || 'XAF';
  const range = req.query.range || 'month';
  const { start, end } = req.query;
  const data = await getProfitLossPage(req.businessId, { currency, range, start, end });
  res.json({ ok: true, data });
});

export const landedCostCalculate = asyncHandler(async (req, res) => {
  const { goodsUsd = 4800, freightUsd = 820, dutyPct = 18, items = 48 } = req.body || {};
  const data = calcLandedCost(goodsUsd, freightUsd, dutyPct, items);
  res.json({ ok: true, data });
});

export const exportData = asyncHandler(async (req, res) => {
  const type = req.query.type || 'cashflow';
  const range = req.query.range || 'month';
  let rows = [];
  if (type === 'revenue') {
    const s = await getRevenueSummary(req.businessId, { range });
    rows = s.bySource;
  } else if (type === 'expenses') {
    rows = await getExpenseCategoriesTable(req.businessId, range);
  } else if (type === 'pl') {
    rows = await plByShipment(req.businessId, req.query.currency || 'USD');
  } else {
    rows = await getCashFlow(req.businessId);
  }
  if (req.query.format === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.send(Buffer.from(`CargoTrader Finance Export - ${type}`));
    return;
  }
  res.setHeader('Content-Type', 'text/csv');
  res.send(JSON.stringify(rows));
});
