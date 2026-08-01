import FinanceEntry from '../models/FinanceEntry.js';
import Shipment from '../models/Shipment.js';
import PosTransaction from '../models/PosTransaction.js';
import Sale from '../models/Sale.js';
import { Warehouse } from '../models/Warehouse.js';
import {
  RATE_DISPLAY,
  DONUT_COLORS
} from '../constants/financeConstants.js';
import {
  inPeriod,
  inDateRange,
  inCustomRange,
  parseDate,
  fromXaf,
  fmtCurrency,
  normalizeSource,
  normalizeExpenseGroup,
  canonicalizeExpenseCategory,
  last6Months,
  monthKey,
  toXaf,
  rangeToMongoDateFilter,
  rangeToDateBounds,
  previousRangeToDateBounds,
  toBusinessObjectId
} from '../utils/financeHelpers.js';
import { groupDigits } from '../utils/numberFormat.js';
import { ensureFinanceSynced, invalidateFinanceSync, syncFinanceLedger } from './financeSync.service.js';
import {
  productsFromLines,
  revenueDescriptionFromProducts
} from '../utils/financeProductHelpers.js';
import {
  EXPENSE_CATEGORIES,
  COGS_EXPENSE_CATEGORIES,
  OPERATING_EXPENSE_CATEGORIES,
  BELOW_LINE_EXPENSE_CATEGORIES
} from '../constants/financeConstants.js';

function filterLedger(entries, { period, range, start, end } = {}) {
  return entries.filter((e) => {
    const d = e.date;
    if (range === 'custom') return inCustomRange(d, start, end);
    if (range) return inDateRange(d, range);
    if (period) return inPeriod(d, period);
    return true;
  });
}

function entryAmountXaf(e) {
  if (e.amountXaf) return e.amountXaf;
  return toXaf(e.amount, e.currency || 'XAF');
}

function sumBy(entries, type) {
  return entries.filter((e) => e.type === type).reduce((s, e) => s + entryAmountXaf(e), 0);
}

function pct(part, total) {
  return total ? Math.round((part / total) * 1000) / 10 : 0;
}

/** Compact business P&L lines for dashboard previews (matches Profit & Loss page). */
function buildBusinessPlSummary(filtered, currency = 'XAF') {
  const revenue = sumBy(filtered, 'revenue');

  const cogsByCategory = {};
  filtered.filter((e) => e.type === 'expense' && isCogsEntry(e)).forEach((e) => {
    const cat = cogsCategoryForEntry(e);
    cogsByCategory[cat] = (cogsByCategory[cat] || 0) + entryAmountXaf(e);
  });
  const cogs = Object.values(cogsByCategory).reduce((s, n) => s + n, 0);
  const grossProfit = revenue - cogs;
  const grossMarginPct = revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : 0;

  const operatingExpenses = sumExpenses(filtered, (e) => !isCogsEntry(e) && !isBelowLineEntry(e));
  const belowLine = sumExpenses(filtered, isBelowLineEntry);
  const netProfit = grossProfit - operatingExpenses - belowLine;
  const netMarginPct = revenue > 0 ? Math.round((netProfit / revenue) * 1000) / 10 : 0;

  const lines = [
    { key: 'revenue', label: 'Total Revenue', amountXaf: revenue, amountFmt: fmtCurrency(currency, revenue), tone: 'pos' },
    { key: 'cogs', label: 'Cost of Goods Sold', amountXaf: -cogs, amountFmt: fmtCurrency(currency, cogs), tone: 'neg' },
    {
      key: 'gross',
      label: 'Gross Profit',
      amountXaf: grossProfit,
      amountFmt: fmtCurrency(currency, grossProfit),
      tone: grossProfit >= 0 ? 'pos' : 'neg',
      bold: true,
      sub: `${grossMarginPct}% margin`
    },
    {
      key: 'opex',
      label: 'Operating Expenses',
      amountXaf: -operatingExpenses,
      amountFmt: fmtCurrency(currency, operatingExpenses),
      tone: 'neg'
    },
    {
      key: 'net',
      label: 'Net Profit / Loss',
      amountXaf: netProfit,
      amountFmt: fmtCurrency(currency, netProfit),
      tone: netProfit >= 0 ? 'pos' : 'neg',
      bold: true,
      sub: `${netMarginPct}% net margin`
    }
  ];

  return {
    revenue,
    revenueFmt: fmtCurrency(currency, revenue),
    cogs,
    cogsFmt: fmtCurrency(currency, cogs),
    grossProfit,
    grossProfitFmt: fmtCurrency(currency, grossProfit),
    grossMarginPct,
    operatingExpenses,
    operatingExpensesFmt: fmtCurrency(currency, operatingExpenses),
    netProfit,
    netProfitFmt: fmtCurrency(currency, netProfit),
    netMarginPct,
    lines
  };
}

export async function getDashboard(businessId, { period = 'month', currency = 'USD' } = {}) {
  await ensureFinanceSynced(businessId);

  const dateFilter = rangeToMongoDateFilter(null, null, null, period);
  const match = { business: toBusinessObjectId(businessId), ...dateFilter };

  const [entries, recentEntries, shipments] = await Promise.all([
    FinanceEntry.find(match).lean(),
    FinanceEntry.find(match).sort({ date: -1 }).limit(5).lean(),
    Shipment.find({ business: businessId }).sort({ updatedAt: -1 }).limit(1).lean()
  ]);

  const typeMap = {};
  for (const e of entries) {
    const t = e.type || 'other';
    if (!typeMap[t]) typeMap[t] = { _id: t, amountXaf: 0, count: 0 };
    typeMap[t].amountXaf += e.amountXaf || 0;
    typeMap[t].count += 1;
  }
  const typeTotals = Object.values(typeMap);

  const sourceMap = {};
  for (const e of entries.filter((x) => x.type === 'revenue')) {
    const src = e.source || 'Other';
    sourceMap[src] = (sourceMap[src] || 0) + (e.amountXaf || 0);
  }
  const sourceGroups = Object.entries(sourceMap)
    .map(([_id, amountXaf]) => ({ _id, amountXaf }))
    .sort((a, b) => b.amountXaf - a.amountXaf)
    .slice(0, 20);

  const expenseMap = {};
  for (const e of entries.filter((x) => x.type === 'expense')) {
    const category = e.category || 'Other';
    const source = e.source || '';
    const key = `${category}||${source}`;
    if (!expenseMap[key]) expenseMap[key] = { _id: { category, source }, amountXaf: 0 };
    expenseMap[key].amountXaf += e.amountXaf || 0;
  }
  const expenseGroups = Object.values(expenseMap)
    .sort((a, b) => b.amountXaf - a.amountXaf)
    .slice(0, 100);

  const revenueXaf = typeTotals.find((t) => t._id === 'revenue')?.amountXaf || 0;
  const expensesXaf = typeTotals.find((t) => t._id === 'expense')?.amountXaf || 0;
  const profitXaf = revenueXaf - expensesXaf;
  const revenueCount = typeTotals.find((t) => t._id === 'revenue')?.count || 0;

  const byCategory = {};
  expenseGroups.forEach((g) => {
    const cat = g._id?.category || 'Other';
    byCategory[cat] = (byCategory[cat] || 0) + (g.amountXaf || 0);
  });
  const topExpenseCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

  const revenueBySource = {};
  sourceGroups.forEach((g) => {
    const src = normalizeSource(g._id);
    revenueBySource[src] = (revenueBySource[src] || 0) + (g.amountXaf || 0);
  });

  const recentTransactions = recentEntries.map((e) => ({
    id: e.entryId || String(e._id),
    date: e.date,
    description: e.description,
    source: e.source,
    category: e.category,
    type: e.type,
    amountXaf: e.amountXaf,
    amount: fmtCurrency(currency, e.amountXaf),
    auto: e.auto
  }));

  const plLedger = [
    { type: 'revenue', amountXaf: revenueXaf },
    ...expenseGroups.map((g) => ({
      type: 'expense',
      category: g._id?.category || 'Other',
      source: g._id?.source || '',
      amountXaf: g.amountXaf || 0
    }))
  ];
  const plSummary = buildBusinessPlSummary(plLedger, currency);

  const firstShipment = shipments[0] || null;
  const goodsUsd = firstShipment ? fromXaf(firstShipment.goodsCost || 0, 'USD') : 4800;
  const freightUsd = firstShipment ? fromXaf(firstShipment.shippingCost || 0, 'USD') : 820;
  const dutyPct = firstShipment?.dutyPct || 18;
  const items = firstShipment?.items || 48;
  const landed = calcLandedCost(goodsUsd, freightUsd, dutyPct, items);

  return {
    kpis: {
      revenue: fmtCurrency(currency, revenueXaf),
      revenueXaf,
      expenses: fmtCurrency(currency, expensesXaf),
      expensesXaf,
      profit: fmtCurrency(currency, profitXaf),
      profitXaf,
      marginPct: revenueXaf > 0 ? Math.round(((profitXaf / revenueXaf) * 100) * 10) / 10 : 0,
      revenueTxnCount: revenueCount,
      topExpenseCategory
    },
    revenueBySource: Object.entries(revenueBySource).map(([source, amountXaf]) => ({
      source,
      amountXaf,
      amount: fmtCurrency(currency, amountXaf),
      pct: pct(amountXaf, revenueXaf)
    })),
    expenseByCategory: Object.entries(byCategory).map(([category, amountXaf], i) => ({
      category,
      amountXaf,
      amount: fmtCurrency(currency, amountXaf),
      pct: pct(amountXaf, expensesXaf),
      color: DONUT_COLORS[i % DONUT_COLORS.length]
    })),
    cashFlow: {
      inXaf: revenueXaf,
      outXaf: expensesXaf,
      netXaf: profitXaf,
      inFmt: fmtCurrency(currency, revenueXaf),
      outFmt: fmtCurrency(currency, expensesXaf),
      netFmt: fmtCurrency(currency, profitXaf),
      recentTransactions
    },
    plSummary,
    exchangeRates: RATE_DISPLAY,
    landedCostPreview: {
      reference: firstShipment?.shipmentId || 'SHP-2026-042',
      goods: goodsUsd,
      freight: freightUsd,
      duties: Math.round((goodsUsd + freightUsd) * (dutyPct / 100)),
      totalUsd: landed.totalUsd,
      perItemUsd: landed.perItemUsd,
      totalXaf: landed.totalXaf
    }
  };
}

export function calcLandedCost(goodsUsd, freightUsd, dutyPct, items) {
  const goods = Number(goodsUsd) || 0;
  const freight = Number(freightUsd) || 0;
  const duty = (goods + freight) * ((Number(dutyPct) || 0) / 100);
  const totalUsd = Math.round(goods + freight + duty);
  const n = Math.max(Number(items) || 1, 1);
  return {
    totalUsd,
    perItemUsd: Math.round(totalUsd / n),
    totalXaf: totalUsd * 600,
    dutyUsd: Math.round(duty)
  };
}

export async function plByShipment(businessId, currency = 'USD') {
  const data = await getProfitLossPage(businessId, { currency });
  return data.rows;
}

function shippingMethodIcon(method) {
  if (method === 'air') return 'fa-plane';
  if (method === 'traveler') return 'fa-suitcase-rolling';
  return 'fa-ship';
}

function shippingMethodLabel(method, eta) {
  const label = method === 'air' ? 'Air freight' : method === 'traveler' ? 'Traveler' : 'Ocean freight';
  return eta ? `${label} · ${eta}` : label;
}

function plTabCategory(s, profit) {
  const completed = s.mode === 'completed' || ['Delivered', 'Closed'].includes(s.status);
  if (profit < 0) return 'loss';
  if (completed) return 'completed';
  return 'in_transit';
}

function plStatusLabel(s, profit) {
  if (profit < 0 && (s.salesRevenue || 0) > 0) return 'Loss';
  if (s.mode === 'completed' || ['Delivered', 'Closed'].includes(s.status)) return 'Completed';
  if (['In Transit', 'Pending', 'At Customs', 'Arrived', 'Delayed'].includes(s.status)) return 'In Transit';
  return s.status || 'In Transit';
}

function formatPlRow(s, currency = 'USD') {
  const goods = s.goodsCost || 0;
  const ship = s.shippingCost || 0;
  const duties = s.dutiesCost || 0;
  const shipDuties = ship + duties;
  const totalCost = goods + shipDuties;
  const sales = s.salesRevenue || 0;
  const profit = sales - totalCost;
  const margin = sales > 0 ? Math.round((profit / sales) * 100) : 0;
  const routeLabel = `${s.origin || '—'} → ${s.dest || '—'}`;
  const created = s.createdAt ? new Date(s.createdAt) : null;
  const dateLabel = created
    ? created.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  return {
    id: s.shipmentId,
    goods,
    ship,
    duties,
    shipDuties,
    totalCost,
    sales,
    profit,
    margin,
    dateLabel,
    origin: s.origin,
    dest: s.dest,
    originFlag: s.originFlag || '🌍',
    destFlag: s.destFlag || '🇨🇲',
    routeLabel,
    methodLabel: shippingMethodLabel(s.shippingMethod, s.eta),
    shippingMethod: s.shippingMethod || 'ocean',
    methodIcon: shippingMethodIcon(s.shippingMethod),
    statusLabel: plStatusLabel(s, profit),
    tab: plTabCategory(s, profit),
    goodsFmt: fmtCurrency(currency, goods),
    shipFmt: fmtCurrency(currency, shipDuties),
    totalCostFmt: fmtCurrency(currency, totalCost),
    salesFmt: fmtCurrency(currency, sales),
    profitFmt: fmtCurrency(currency, profit)
  };
}

function pctChange(current, previous) {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function pctOf(part, total) {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

function filterLedgerForRange(ledger, range, start, end) {
  return ledger.filter((e) => {
    if (range === 'custom') return inCustomRange(e.date, start, end);
    if (range) return inDateRange(e.date, range);
    return true;
  });
}

function filterPreviousPeriod(ledger, range) {
  if (range === 'custom') return [];
  const now = new Date();
  return ledger.filter((e) => {
    const d = parseDate(e.date);
    if (!d) return false;
    if (range === 'today') {
      const y = new Date(now);
      y.setDate(now.getDate() - 1);
      return d.toDateString() === y.toDateString();
    }
    if (range === 'last_month' || range === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return d >= start && d <= end;
    }
    if (range === 'quarter') {
      const q = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), (q - 1) * 3, 1);
      const end = new Date(now.getFullYear(), q * 3, 0, 23, 59, 59, 999);
      return d >= start && d <= end;
    }
    if (range === 'ytd') {
      return d.getFullYear() === now.getFullYear() - 1;
    }
    return false;
  });
}

function isCogsEntry(e) {
  const cat = canonicalizeExpenseCategory(e.category || '');
  const group = normalizeExpenseGroup(cat, e.source);
  if (group === 'Purchases' || group === 'Shipping') return true;
  return COGS_EXPENSE_CATEGORIES.includes(cat);
}

function cogsCategoryForEntry(e) {
  const cat = canonicalizeExpenseCategory(e.category || '');
  if (COGS_EXPENSE_CATEGORIES.includes(cat)) return cat;
  if (cat === 'Customs & Duties') return 'Customs & Duties';
  if (cat === 'Freight & Shipping') return 'Freight & Shipping';
  const group = normalizeExpenseGroup(cat, e.source);
  if (group === 'Shipping') return 'Freight & Shipping';
  return 'Goods / COGS';
}

function buildCogsLines(byCategory) {
  return COGS_EXPENSE_CATEGORIES.map((label) => ({
    key: label,
    label,
    amountXaf: byCategory[label] || 0
  }));
}

function isBelowLineEntry(e) {
  const cat = canonicalizeExpenseCategory(e.category || '');
  return BELOW_LINE_EXPENSE_CATEGORIES.includes(cat);
}

function sumExpenses(entries, predicate) {
  return entries
    .filter((e) => e.type === 'expense' && predicate(e))
    .reduce((s, e) => s + entryAmountXaf(e), 0);
}

function fmtPlAmount(xaf, { negative = false, currency = 'XAF' } = {}) {
  const n = Math.abs(xaf || 0);
  const core = currency === 'XAF'
    ? groupDigits(n)
    : fmtCurrency(currency, n).replace(/[^\d,.\-+$€£]/g, '').trim() || String(n);
  if (negative || xaf < 0) return `(${core})`;
  return core;
}

function buildOperatingLines(byCategory) {
  return OPERATING_EXPENSE_CATEGORIES.map((label) => ({
    key: label,
    label,
    amountXaf: byCategory[label] || 0
  }));
}

export async function getProfitLossPage(businessId, { currency = 'XAF', range = 'month', start, end } = {}) {
  await ensureFinanceSynced(businessId);
  const currentBounds = rangeToDateBounds(range, start, end);
  const prevBounds = previousRangeToDateBounds(range);
  const [filtered, previous] = await Promise.all([
    FinanceEntry.find({
      business: businessId,
      ...(currentBounds ? { date: currentBounds } : {})
    }).lean(),
    prevBounds
      ? FinanceEntry.find({ business: businessId, date: prevBounds }).lean()
      : Promise.resolve([])
  ]);

  const revenue = sumBy(filtered, 'revenue');

  const cogsByCategory = {};
  filtered.filter((e) => e.type === 'expense' && isCogsEntry(e)).forEach((e) => {
    const cat = cogsCategoryForEntry(e);
    cogsByCategory[cat] = (cogsByCategory[cat] || 0) + entryAmountXaf(e);
  });
  const cogsLines = buildCogsLines(cogsByCategory);
  const cogs = cogsLines.reduce((s, l) => s + l.amountXaf, 0);
  const grossProfit = revenue - cogs;
  const grossMarginPct = revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : 0;

  const byCategory = {};
  filtered.filter((e) => e.type === 'expense' && !isCogsEntry(e) && !isBelowLineEntry(e)).forEach((e) => {
    const raw = canonicalizeExpenseCategory(e.category || 'Others (repairs, fees, misc.)');
    const cat = OPERATING_EXPENSE_CATEGORIES.includes(raw)
      ? raw
      : 'Others (repairs, fees, misc.)';
    byCategory[cat] = (byCategory[cat] || 0) + entryAmountXaf(e);
  });

  const operatingLines = buildOperatingLines(byCategory);
  const operatingExpenses = operatingLines.reduce((s, l) => s + l.amountXaf, 0);
  const ebit = grossProfit - operatingExpenses;

  const interest = sumExpenses(filtered, (e) => canonicalizeExpenseCategory(e.category || '') === 'Interest Expense');
  const taxes = sumExpenses(filtered, (e) => canonicalizeExpenseCategory(e.category || '') === 'Taxes (estimated)');
  const belowLine = interest + taxes;
  const netProfit = ebit - belowLine;
  const netMarginPct = revenue > 0 ? Math.round((netProfit / revenue) * 1000) / 10 : 0;

  const prevRevenue = sumBy(previous, 'revenue');
  const prevCogs = sumExpenses(previous, isCogsEntry);
  const prevGross = prevRevenue - prevCogs;
  const prevOp = sumExpenses(previous, (e) => !isCogsEntry(e) && !isBelowLineEntry(e));
  const prevNet = prevGross - prevOp - sumExpenses(previous, isBelowLineEntry);
  const prevGrossMargin = prevRevenue > 0 ? (prevGross / prevRevenue) * 100 : 0;

  const opCategoryCount = Object.keys(byCategory).filter((k) => byCategory[k] > 0).length;

  const statement = [
    { type: 'section', tone: 'revenue', label: 'REVENUE' },
    { type: 'line', label: 'Total Revenue', amountXaf: revenue },
    { type: 'line', label: 'Gross Sales Revenue', amountXaf: revenue, bold: true, accent: 'revenue' },
    { type: 'section', tone: 'cogs', label: 'COST OF GOODS SOLD' },
    ...cogsLines.map((l) => ({
      type: 'line',
      label: l.label,
      amountXaf: -l.amountXaf,
      negative: true
    })),
    {
      type: 'section',
      tone: 'cogs-total',
      label: 'TOTAL COST OF GOODS SOLD',
      amountXaf: -cogs,
      negative: true
    },
    { type: 'section', tone: 'gross', label: 'GROSS PROFIT', amountXaf: grossProfit, sub: `${grossMarginPct}% margin` },
    { type: 'section', tone: 'opex', label: 'OPERATING EXPENSES' },
    ...operatingLines.map((l) => ({
      type: 'line',
      label: l.label,
      amountXaf: -l.amountXaf,
      negative: true
    })),
    {
      type: 'section',
      tone: 'opex-total',
      label: 'TOTAL OPERATING EXPENSES',
      amountXaf: -operatingExpenses,
      negative: true
    },
    { type: 'section', tone: 'ebit', label: 'OPERATING PROFIT (EBIT)', amountXaf: ebit },
    { type: 'section', tone: 'below', label: 'BELOW THE LINE' },
    { type: 'line', label: 'Interest Expense', amountXaf: interest ? -interest : 0, negative: Boolean(interest) },
    { type: 'line', label: 'Taxes (estimated)', amountXaf: taxes ? -taxes : 0, negative: Boolean(taxes) },
    { type: 'section', tone: 'net', label: 'NET PROFIT / LOSS', amountXaf: netProfit, highlight: true }
  ].map((row) => ({
    ...row,
    amountFmt: row.amountXaf != null ? fmtPlAmount(row.amountXaf, { negative: row.negative, currency }) : ''
  }));

  return {
    kpis: {
      revenue,
      revenueFmt: fmtCurrency(currency, revenue),
      revenueUsdFmt: fmtCurrency('USD', revenue),
      revenueTrend: pctChange(revenue, prevRevenue),
      cogs,
      cogsFmt: fmtCurrency(currency, cogs),
      cogsUsdFmt: fmtCurrency('USD', cogs),
      cogsPctOfRevenue: pctOf(cogs, revenue),
      cogsTrend: pctChange(cogs, prevCogs),
      grossMarginPct,
      grossMarginTrend: Math.round((grossMarginPct - prevGrossMargin) * 10) / 10,
      operatingExpenses,
      operatingExpensesFmt: fmtCurrency(currency, operatingExpenses),
      operatingExpensesUsdFmt: fmtCurrency('USD', operatingExpenses),
      operatingTrend: pctChange(operatingExpenses, prevOp),
      opCategoryCount,
      netProfit,
      netProfitFmt: fmtCurrency(currency, netProfit),
      netProfitUsdFmt: fmtCurrency('USD', netProfit),
      netProfitTrend: pctChange(netProfit, prevNet),
      netMarginPct,
      ebit,
      ebitFmt: fmtCurrency(currency, ebit)
    },
    statement,
    totals: {
      sales: revenue,
      totalCost: cogs + operatingExpenses + belowLine,
      profit: netProfit,
      salesFmt: fmtCurrency(currency, revenue),
      totalCostFmt: fmtCurrency(currency, cogs + operatingExpenses + belowLine),
      profitFmt: fmtCurrency(currency, netProfit)
    },
    transactionCount: filtered.length,
    revenueTxnCount: filtered.filter((e) => e.type === 'revenue').length
  };
}

function computeRevenueSummary(ledger, { range = null, currency = 'USD' } = {}) {
  const filtered = range ? filterLedger(ledger, { range }) : ledger;
  const totalXaf = sumBy(filtered, 'revenue');

  const bySource = {};
  filtered.forEach((e) => {
    const src = normalizeSource(e.source);
    bySource[src] = (bySource[src] || 0) + e.amountXaf;
  });

  return {
    totalXaf,
    total: fmtCurrency(currency, totalXaf),
    totalXafFmt: fmtCurrency(currency, totalXaf),
    bySource: Object.entries(bySource).map(([source, amountXaf]) => ({
      source,
      amountXaf,
      amount: fmtCurrency(currency, amountXaf),
      pct: pct(amountXaf, totalXaf)
    })),
    posXaf: bySource.POS || 0,
    marketplaceXaf: bySource.Marketplace || 0,
    wholesaleXaf: bySource.Wholesale || 0,
    commissionsXaf: (bySource.Manual || 0) + (bySource.Other || 0) + (bySource.Wholesale || 0)
  };
}

function computeRevenueTrend(ledger, range = 'month') {
  const months = last6Months();
  return months.map((m) => {
    const monthEntries = ledger.filter((e) => monthKey(e.date) === m && inDateRange(e.date, range === 'month' ? 'ytd' : range));
    const pos = monthEntries.filter((e) => normalizeSource(e.source) === 'POS').reduce((s, e) => s + e.amountXaf, 0);
    const marketplace = monthEntries.filter((e) => normalizeSource(e.source) === 'Marketplace').reduce((s, e) => s + e.amountXaf, 0);
    const commissions = monthEntries.filter((e) => !['POS', 'Marketplace'].includes(normalizeSource(e.source))).reduce((s, e) => s + e.amountXaf, 0);
    return { month: m, pos, marketplace, commissions, total: pos + marketplace + commissions };
  });
}

function computeRevenueList(ledger, { range = 'month', page = 1, pageSize = 10, source = 'all', search = '', lookups = null } = {}) {
  let rows = filterLedger(ledger, { range }).sort((a, b) => new Date(b.date) - new Date(a.date));
  if (source !== 'all') {
    rows = rows.filter((e) => normalizeSource(e.source) === source);
  }
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter((e) => {
      const products = resolveEntryProducts(e, lookups);
      const productText = products.map((p) => `${p.name} ${p.sku}`).join(' ').toLowerCase();
      return (
        e.description?.toLowerCase().includes(q) ||
        e.reference?.toLowerCase().includes(q) ||
        normalizeSource(e.source).toLowerCase().includes(q) ||
        productText.includes(q)
      );
    });
  }
  const total = rows.length;
  const start = (page - 1) * pageSize;
  const data = rows.slice(start, start + pageSize).map((e) => formatRevenueListRow(e, lookups));
  return { data, pagination: { page, pageSize, total } };
}

async function loadRevenueProductLookups(businessId, entries) {
  const posIds = new Set();
  const saleIds = new Set();

  for (const e of entries) {
    if (e.products?.length) continue;
    const ref = e.reference && e.reference !== '—' ? e.reference : '';
    if (e.linkedId?.startsWith('pos-') || (normalizeSource(e.source) === 'POS' && ref)) {
      posIds.add(ref || e.linkedId.replace(/^pos-/, ''));
    } else if (e.linkedId?.startsWith('sale-')) {
      saleIds.add(ref || e.linkedId.replace(/^sale-/, ''));
    }
  }

  const [posRows, saleRows] = await Promise.all([
    posIds.size
      ? PosTransaction.find({ business: businessId, transactionId: { $in: [...posIds] } })
        .select('transactionId lines')
        .lean()
      : [],
    saleIds.size
      ? Sale.find({ business: businessId, saleId: { $in: [...saleIds] } })
        .select('saleId lines items')
        .lean()
      : []
  ]);

  return {
    posMap: new Map(posRows.map((t) => [t.transactionId, t.lines || []])),
    saleMap: new Map(saleRows.map((s) => [s.saleId, s.lines?.length ? s.lines : s.items || []]))
  };
}

function resolveEntryProducts(entry, lookups) {
  if (entry.products?.length) return entry.products;
  if (!lookups) return [];

  const ref = entry.reference && entry.reference !== '—' ? entry.reference : '';
  if (entry.linkedId?.startsWith('pos-') || normalizeSource(entry.source) === 'POS') {
    const id = ref || entry.linkedId?.replace(/^pos-/, '');
    return productsFromLines(lookups.posMap?.get(id));
  }
  if (entry.linkedId?.startsWith('sale-')) {
    const id = ref || entry.linkedId?.replace(/^sale-/, '');
    return productsFromLines(lookups.saleMap?.get(id));
  }
  return [];
}

function formatRevenueListRow(entry, lookups) {
  const products = resolveEntryProducts(entry, lookups);
  const description = products.length
    ? revenueDescriptionFromProducts(products, entry.description)
    : entry.description;

  return {
    id: entry.entryId || String(entry._id),
    date: entry.date,
    source: normalizeSource(entry.source),
    description,
    products,
    amount: entry.amount,
    currency: entry.currency || 'XAF',
    amountXaf: entry.amountXaf,
    amountUsd: fromXaf(entry.amountXaf, 'USD'),
    reference: entry.reference || '—',
    status: entry.auto ? 'Synced' : 'Recorded',
    auto: Boolean(entry.auto)
  };
}

export async function enrichRevenueEntry(businessId, entry) {
  const e = entry?.toObject ? entry.toObject() : entry;
  if (!e || e.type !== 'revenue') return e;
  if (e.products?.length) {
    return {
      ...e,
      description: revenueDescriptionFromProducts(e.products, e.description),
      products: e.products
    };
  }
  const lookups = await loadRevenueProductLookups(businessId, [e]);
  const products = resolveEntryProducts(e, lookups);
  return {
    ...e,
    products,
    description: products.length ? revenueDescriptionFromProducts(products, e.description) : e.description
  };
}

function computeRevenueCategories(txns, { range = null, currency = 'USD' } = {}) {
  const cats = {};
  const scoped = range ? txns.filter((t) => inDateRange(t.date, range)) : txns;
  scoped.forEach((t) => {
    (t.lines || []).forEach((l) => {
      const cat = l.category || 'Other';
      cats[cat] = (cats[cat] || 0) + (l.price || 0) * (l.qty || 1);
    });
  });
  const total = Object.values(cats).reduce((s, v) => s + v, 0) || 1;
  return Object.entries(cats).map(([name, amountXaf]) => ({
    name,
    amountXaf,
    amount: fmtCurrency(currency, amountXaf),
    pct: pct(amountXaf, total)
  })).sort((a, b) => b.amountXaf - a.amountXaf);
}

function computeRevenueWarehouses(warehouses, txns, { range = null, currency = 'USD' } = {}) {
  const filtered = range ? txns.filter((t) => inDateRange(t.date, range)) : txns;
  const totalXaf = filtered.reduce((s, t) => s + t.total, 0);
  return {
    warehouses: warehouses.map((w) => ({
      id: w.warehouseId,
      name: w.name,
      amountXaf: w.warehouseId === 'wh-c' || w.warehouseId === 'wh-d' ? Math.round(totalXaf * 0.25) : 0,
      amount: fmtCurrency(currency, w.warehouseId === 'wh-c' || w.warehouseId === 'wh-d' ? Math.round(totalXaf * 0.25) : 0),
      active: true
    })),
    totalXaf,
    total: fmtCurrency(currency, totalXaf)
  };
}

async function loadTypedLedger(businessId, type, range) {
  const dateFilter = rangeToMongoDateFilter(range);
  return FinanceEntry.find({ business: businessId, type, ...dateFilter }).sort({ date: -1 }).lean();
}

export async function getRevenueOverview(businessId, { range = 'month', currency = 'USD', page = 1, pageSize = 25 } = {}) {
  await ensureFinanceSynced(businessId);
  const limit = Math.min(100, Math.max(1, Number(pageSize) || 25));
  const pageNum = Math.max(1, Number(page) || 1);
  const skip = (pageNum - 1) * limit;
  const dateFilter = rangeToMongoDateFilter(range);
  const filter = { business: businessId, type: 'revenue', ...dateFilter };
  const [ledger, total, slice] = await Promise.all([
    FinanceEntry.find(filter).select('type amountXaf amount currency source date category').lean(),
    FinanceEntry.countDocuments(filter),
    FinanceEntry.find(filter).sort({ date: -1 }).skip(skip).limit(limit).lean()
  ]);
  const lookups = await loadRevenueProductLookups(businessId, slice);
  return {
    summary: computeRevenueSummary(ledger, { currency }),
    list: {
      data: slice.map((e) => formatRevenueListRow(e, lookups)),
      pagination: {
        page: pageNum,
        pageSize: limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit))
      }
    }
  };
}

export async function getRevenueSummary(businessId, { range = 'month', currency = 'USD' } = {}) {
  await ensureFinanceSynced(businessId);
  const ledger = await loadTypedLedger(businessId, 'revenue', range);
  return computeRevenueSummary(ledger, { currency });
}

export async function getRevenueTrend(businessId, range = 'month') {
  await ensureFinanceSynced(businessId);
  const ledger = await loadTypedLedger(businessId, 'revenue', range === 'month' ? 'ytd' : range);
  return computeRevenueTrend(ledger, range);
}

export async function getRevenueSales(businessId, { range = 'month', page = 1, pageSize = 25, source = 'all', search = '' } = {}) {
  await ensureFinanceSynced(businessId);
  const limit = Math.min(100, Math.max(1, Number(pageSize) || 25));
  const pageNum = Math.max(1, Number(page) || 1);
  const skip = (pageNum - 1) * limit;
  const dateFilter = rangeToMongoDateFilter(range);
  const filter = { business: businessId, type: 'revenue', ...dateFilter };
  if (source !== 'all') filter.source = new RegExp(`^${String(source).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  if (search) {
    const q = String(search).trim();
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ description: regex }, { reference: regex }, { source: regex }];
    }
  }
  const [total, slice] = await Promise.all([
    FinanceEntry.countDocuments(filter),
    FinanceEntry.find(filter).sort({ date: -1 }).skip(skip).limit(limit).lean()
  ]);
  const lookups = await loadRevenueProductLookups(businessId, slice);
  return {
    data: slice.map((e) => formatRevenueListRow(e, lookups)),
    pagination: { page: pageNum, pageSize: limit, total, pages: Math.max(1, Math.ceil(total / limit)) }
  };
}

function computeExpenseSummary(ledger, { range = null, currency = 'USD' } = {}) {
  const filtered = range ? filterLedger(ledger, { range }) : ledger;
  const totalXaf = sumBy(filtered, 'expense');

  const groups = { Purchases: 0, Shipping: 0, Operating: 0, Other: 0 };
  filtered.forEach((e) => {
    const g = normalizeExpenseGroup(e.category, e.source);
    groups[g] = (groups[g] || 0) + e.amountXaf;
  });

  return {
    totalXaf,
    total: fmtCurrency(currency, totalXaf),
    totalXafFmt: fmtCurrency(currency, totalXaf),
    purchasesXaf: groups.Purchases,
    shippingXaf: groups.Shipping,
    operatingXaf: groups.Operating,
    purchasesPct: pct(groups.Purchases, totalXaf),
    shippingPct: pct(groups.Shipping, totalXaf),
    operatingPct: pct(groups.Operating, totalXaf)
  };
}

function computeExpenseTrend(ledger) {
  const months = last6Months();
  return months.map((m) => {
    const monthEntries = ledger.filter((e) => monthKey(e.date) === m);
    const purchases = monthEntries.filter((e) => normalizeExpenseGroup(e.category, e.source) === 'Purchases').reduce((s, e) => s + e.amountXaf, 0);
    const shipping = monthEntries.filter((e) => normalizeExpenseGroup(e.category, e.source) === 'Shipping').reduce((s, e) => s + e.amountXaf, 0);
    const operating = monthEntries.filter((e) => normalizeExpenseGroup(e.category, e.source) === 'Operating').reduce((s, e) => s + e.amountXaf, 0);
    return { month: m, purchases, shipping, operating, total: purchases + shipping + operating };
  });
}

function computeExpenseList(ledger, { range = null, page = 1, pageSize = 10, category = 'all', search = '' } = {}) {
  let rows = range ? filterLedger(ledger, { range }) : ledger;
  if (category !== 'all') rows = rows.filter((e) => e.category === category);
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter((e) =>
      e.description?.toLowerCase().includes(q) ||
      e.shipmentId?.toLowerCase().includes(q) ||
      e.category?.toLowerCase().includes(q)
    );
  }
  const total = rows.length;
  const start = (page - 1) * pageSize;
  const data = rows.slice(start, start + pageSize).map((e) => ({
    id: e.entryId || String(e._id),
    date: e.date,
    category: e.category || 'Other',
    description: e.description,
    amountXaf: e.amountXaf,
    amountUsd: fromXaf(e.amountXaf, 'USD'),
    relatedTo: e.shipmentId || e.reference || '—',
    amount: e.amount,
    currency: e.currency || 'XAF',
    reference: e.reference || '',
    shipmentId: e.shipmentId || '',
    status: e.auto ? 'Synced' : 'Recorded',
    auto: Boolean(e.auto),
    source: e.source
  }));
  return { data, pagination: { page, pageSize, total } };
}

function computeExpenseCategoriesTable(ledger, { range = null, currency = 'USD' } = {}) {
  const filtered = range ? filterLedger(ledger, { range }) : ledger;
  const byCat = {};
  filtered.forEach((e) => {
    const cat = e.category || 'Other';
    if (!byCat[cat]) byCat[cat] = { amountXaf: 0, count: 0 };
    byCat[cat].amountXaf += e.amountXaf;
    byCat[cat].count += 1;
  });
  const total = sumBy(filtered, 'expense');
  return Object.entries(byCat).map(([category, v]) => ({
    category,
    amountXaf: v.amountXaf,
    amount: fmtCurrency(currency, v.amountXaf),
    pct: pct(v.amountXaf, total),
    transactions: v.count,
    avg: fmtCurrency(currency, v.count ? v.amountXaf / v.count : 0),
    vsBudget: category === 'Freight & Shipping' ? 100 : Math.round(Math.random() * 30),
    trend: 'up'
  }));
}

function computeExpenseInsights(summary) {
  return [
    `Shipping & logistics: ${summary.total} (${summary.shippingPct}% of expenses)`,
    `Purchases / COGS: ${summary.totalXafFmt} from purchases and inventory costs`
  ];
}

export async function getExpensesOverview(businessId, { range = 'month', currency = 'USD', page = 1, pageSize = 25 } = {}) {
  await ensureFinanceSynced(businessId);
  const limit = Math.min(100, Math.max(1, Number(pageSize) || 25));
  const pageNum = Math.max(1, Number(page) || 1);
  const skip = (pageNum - 1) * limit;
  const dateFilter = rangeToMongoDateFilter(range);
  const filter = { business: businessId, type: 'expense', ...dateFilter };
  const [ledger, total, slice, ytdLedger] = await Promise.all([
    FinanceEntry.find(filter).select('type amountXaf amount currency source date category').lean(),
    FinanceEntry.countDocuments(filter),
    FinanceEntry.find(filter).sort({ date: -1 }).skip(skip).limit(limit).lean(),
    loadTypedLedger(businessId, 'expense', 'ytd')
  ]);
  const summary = computeExpenseSummary(ledger, { currency });
  return {
    summary,
    trend: computeExpenseTrend(ytdLedger),
    categories: computeExpenseCategoriesTable(ledger, { currency }),
    list: {
      data: slice.map((e) => ({
        id: e.entryId || String(e._id),
        date: e.date,
        description: e.description,
        category: canonicalizeExpenseCategory(e.category || 'Others (repairs, fees, misc.)'),
        source: e.source || 'Manual',
        amount: e.amount,
        currency: e.currency || 'XAF',
        amountXaf: e.amountXaf,
        amountUsd: fromXaf(e.amountXaf, 'USD'),
        reference: e.reference || '—',
        relatedTo: e.shipmentId || e.reference || '—',
        shipmentId: e.shipmentId || '',
        status: e.auto ? 'Synced' : 'Recorded',
        auto: Boolean(e.auto),
        receipts: Array.isArray(e.receipts) ? e.receipts.filter(Boolean) : []
      })),
      pagination: {
        page: pageNum,
        pageSize: limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit))
      }
    },
    insights: computeExpenseInsights(summary)
  };
}

export async function getExpenseSummary(businessId, { range = 'month', currency = 'USD' } = {}) {
  await ensureFinanceSynced(businessId);
  const ledger = await loadTypedLedger(businessId, 'expense', range);
  return computeExpenseSummary(ledger, { currency });
}

export async function getExpenseTrend(businessId) {
  await ensureFinanceSynced(businessId);
  const ledger = await loadTypedLedger(businessId, 'expense', 'ytd');
  return computeExpenseTrend(ledger);
}

export async function getExpenseList(businessId, { range = 'month', page = 1, pageSize = 25, category = 'all', search = '' } = {}) {
  await ensureFinanceSynced(businessId);
  const limit = Math.min(100, Math.max(1, Number(pageSize) || 25));
  const pageNum = Math.max(1, Number(page) || 1);
  const skip = (pageNum - 1) * limit;
  const dateFilter = rangeToMongoDateFilter(range);
  const filter = { business: businessId, type: 'expense', ...dateFilter };
  if (category && category !== 'all') {
    filter.category = new RegExp(String(category).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }
  if (search) {
    const q = String(search).trim();
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ description: regex }, { reference: regex }, { category: regex }, { source: regex }];
    }
  }
  const [total, slice] = await Promise.all([
    FinanceEntry.countDocuments(filter),
    FinanceEntry.find(filter).sort({ date: -1 }).skip(skip).limit(limit).lean()
  ]);
  return {
    data: slice.map((e) => ({
      id: e.entryId || String(e._id),
      date: e.date,
      description: e.description,
      category: canonicalizeExpenseCategory(e.category || 'Others (repairs, fees, misc.)'),
      source: e.source || 'Manual',
      amount: e.amount,
      currency: e.currency || 'XAF',
      amountXaf: e.amountXaf,
      amountUsd: fromXaf(e.amountXaf, 'USD'),
      reference: e.reference || '—',
      shipmentId: e.shipmentId || '',
      status: e.auto ? 'Synced' : 'Recorded',
      auto: Boolean(e.auto),
      receipts: Array.isArray(e.receipts) ? e.receipts.filter(Boolean) : []
    })),
    pagination: { page: pageNum, pageSize: limit, total, pages: Math.max(1, Math.ceil(total / limit)) }
  };
}

export async function getCashFlow(businessId, currency = 'USD') {
  const data = await getCashFlowPage(businessId, { currency });
  return data.rows;
}

function isRefundEntry(e) {
  const cat = String(e.category || '').toLowerCase();
  const desc = String(e.description || '').toLowerCase();
  return cat.includes('refund') || desc.includes('return') || (e.linkedId || '').includes('sales-return');
}

function cashFlowTab(e) {
  if (e.auto) return 'synced';
  if (e.type === 'revenue') return 'income';
  if (isRefundEntry(e)) return 'refunds';
  return 'expenses';
}

function sourceBadgeClass(source) {
  const s = String(source || '').toLowerCase();
  if (s.includes('pos')) return 'badge-pos';
  if (s.includes('ship')) return 'badge-shipment';
  if (s.includes('staff') || s.includes('manual')) return 'badge-manual';
  if (s.includes('market')) return 'badge-marketplace';
  return 'badge-source';
}

function categoryBadgeClass(category) {
  const c = String(category || '').toLowerCase();
  if (c.includes('refund')) return 'cf-cat refund';
  if (c.includes('revenue') || c.includes('pos')) return 'cf-cat revenue';
  if (c.includes('customs') || c.includes('dut')) return 'cf-cat customs';
  if (c.includes('freight') || c.includes('ship')) return 'cf-cat freight';
  return 'cf-cat default';
}

function formatCashFlowRow(e, currency = 'XAF') {
  const amountXaf = entryAmountXaf(e);
  const isIn = e.type === 'revenue';
  const sign = isIn ? '+' : '−';
  const absXaf = Math.abs(amountXaf);
  const status = e.auto ? 'Synced' : 'Pending';

  return {
    id: e.entryId || String(e._id),
    date: e.date,
    dateLabel: e.date ? new Date(e.date).toISOString().slice(0, 10) : '—',
    description: e.description || '—',
    source: e.source || 'Manual',
    sourceBadge: sourceBadgeClass(e.source),
    category: e.category || (e.type === 'revenue' ? 'Revenue' : 'Expense'),
    categoryBadge: categoryBadgeClass(e.category),
    amount: e.amount,
    currency: e.currency || 'XAF',
    amountXaf,
    amountXafFmt: `${sign}${fmtCurrency(currency, absXaf)}`,
    amountUsdFmt: '',
    amountFmt: `${sign}${fmtCurrency(currency, absXaf)}`,
    reference: e.reference || '',
    shipmentId: e.shipmentId || '',
    type: e.type,
    status,
    auto: Boolean(e.auto),
    tab: cashFlowTab(e),
    isRefund: isRefundEntry(e)
  };
}

function trendLabelForRange(range) {
  if (range === 'today') return 'vs yesterday';
  if (range === 'last_month') return 'vs prior month';
  return 'vs last month';
}

function cashFlowTabMongoFilter(tab) {
  if (!tab || tab === 'all') return {};
  if (tab === 'income') return { type: 'revenue' };
  if (tab === 'synced') return { auto: true };
  if (tab === 'refunds') {
    return {
      $or: [
        { category: /refund/i },
        { description: /return/i },
        { linkedId: /sales-return/i }
      ]
    };
  }
  if (tab === 'expenses') {
    return {
      type: 'expense',
      category: { $not: /refund/i },
      description: { $not: /return/i },
      linkedId: { $not: /sales-return/i }
    };
  }
  return {};
}

async function sumTypedAmounts(filter) {
  const rows = await FinanceEntry.find(filter).select('type amountXaf').lean();
  let inflowXaf = 0;
  let outflowXaf = 0;
  for (const e of rows) {
    const amt = e.amountXaf || 0;
    if (e.type === 'revenue') inflowXaf += amt;
    else if (e.type === 'expense') outflowXaf += amt;
  }
  return { inflowXaf, outflowXaf };
}

export async function getCashFlowPage(
  businessId,
  { currency = 'XAF', range = 'month', page = 1, pageSize = 25, tab = 'all' } = {}
) {
  await ensureFinanceSynced(businessId);
  const limit = Math.min(100, Math.max(1, Number(pageSize) || 25));
  const pageNum = Math.max(1, Number(page) || 1);
  const skip = (pageNum - 1) * limit;
  const dateFilter = rangeToMongoDateFilter(range);
  const baseFilter = { business: toBusinessObjectId(businessId), ...dateFilter };
  const listFilter = { ...baseFilter, ...cashFlowTabMongoFilter(tab) };
  const prevBounds = previousRangeToDateBounds(range === 'month' ? 'month' : range);

  const [
    totals,
    pageEntries,
    total,
    allCount,
    inCount,
    expenseNonRefund,
    refundCount,
    syncedCount,
    pendingCount,
    priorTotals
  ] = await Promise.all([
    sumTypedAmounts(baseFilter),
    FinanceEntry.find(listFilter).sort({ date: -1 }).skip(skip).limit(limit).lean(),
    FinanceEntry.countDocuments(listFilter),
    FinanceEntry.countDocuments(baseFilter),
    FinanceEntry.countDocuments({ ...baseFilter, type: 'revenue' }),
    FinanceEntry.countDocuments({ ...baseFilter, ...cashFlowTabMongoFilter('expenses') }),
    FinanceEntry.countDocuments({ ...baseFilter, ...cashFlowTabMongoFilter('refunds') }),
    FinanceEntry.countDocuments({ ...baseFilter, auto: true }),
    FinanceEntry.countDocuments({ ...baseFilter, auto: { $ne: true } }),
    prevBounds
      ? sumTypedAmounts({ business: toBusinessObjectId(businessId), date: prevBounds })
      : Promise.resolve({ inflowXaf: 0, outflowXaf: 0 })
  ]);

  const rows = pageEntries.map((e) => formatCashFlowRow(e, currency));
  const inflowXaf = totals.inflowXaf;
  const outflowXaf = totals.outflowXaf;
  const netXaf = inflowXaf - outflowXaf;
  const outCount = expenseNonRefund + refundCount;
  const prevIn = priorTotals.inflowXaf;
  const prevOut = priorTotals.outflowXaf;

  return {
    rows,
    pagination: {
      page: pageNum,
      pageSize: limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit))
    },
    summary: {
      inflowXaf,
      outflowXaf,
      netXaf,
      inflowFmt: fmtCurrency(currency, inflowXaf),
      outflowFmt: fmtCurrency(currency, outflowXaf),
      netFmt: fmtCurrency(currency, netXaf),
      inflowXafFmt: `+${fmtCurrency(currency, inflowXaf)}`,
      outflowXafFmt: `−${fmtCurrency(currency, outflowXaf)}`,
      netXafFmt: `${netXaf >= 0 ? '+' : '−'}${fmtCurrency(currency, Math.abs(netXaf)).replace(/^[+\-−]/, '')}`,
      inflowUsdFmt: '',
      outflowUsdFmt: '',
      netUsdFmt: '',
      inCount,
      outCount,
      syncedCount,
      totalCount: allCount,
      pendingCount,
      inflowTrend: pctChange(inflowXaf, prevIn),
      outflowTrend: pctChange(outflowXaf, prevOut),
      inflowTrendLabel: trendLabelForRange(range),
      netPositive: netXaf >= 0
    },
    tabCounts: {
      all: allCount,
      income: inCount,
      expenses: expenseNonRefund,
      refunds: refundCount,
      synced: syncedCount
    }
  };
}

export async function getExpenseInsights(businessId, range = 'month') {
  const summary = await getExpenseSummary(businessId, { range });
  return computeExpenseInsights(summary);
}

export async function getRevenueCategories(businessId, range = 'month', currency = 'USD') {
  const dateFilter = rangeToMongoDateFilter(range);
  const txns = await PosTransaction.find({
    business: businessId,
    status: 'completed',
    ...dateFilter
  }).lean();
  return computeRevenueCategories(txns, { currency });
}

export async function getRevenueWarehouses(businessId, range = 'month', currency = 'USD') {
  const dateFilter = rangeToMongoDateFilter(range);
  const [warehouses, txns] = await Promise.all([
    Warehouse.find({ business: businessId }).lean(),
    PosTransaction.find({ business: businessId, status: 'completed', ...dateFilter }).lean()
  ]);
  return computeRevenueWarehouses(warehouses, txns, { currency });
}

export async function getExpenseCategoriesTable(businessId, range = 'month', currency = 'USD') {
  await ensureFinanceSynced(businessId);
  const ledger = await loadTypedLedger(businessId, 'expense', range);
  return computeExpenseCategoriesTable(ledger, { currency });
}

export { ensureFinanceSynced, invalidateFinanceSync, syncFinanceLedger, toXaf, fmtCurrency, fromXaf, EXPENSE_CATEGORIES };
