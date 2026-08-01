import { fmtCurrency } from '../constants/financeConstants';

export function emptyProfitLossData(currency = 'XAF') {
  const zero = fmtCurrency(currency, 0);
  return {
    kpis: {
      revenue: 0,
      revenueFmt: zero,
      revenueUsdFmt: fmtCurrency('USD', 0),
      revenueTrend: 0,
      cogs: 0,
      cogsFmt: zero,
      cogsUsdFmt: fmtCurrency('USD', 0),
      cogsPctOfRevenue: 0,
      cogsTrend: 0,
      grossMarginPct: 0,
      grossMarginTrend: 0,
      operatingExpenses: 0,
      operatingExpensesFmt: zero,
      operatingExpensesUsdFmt: fmtCurrency('USD', 0),
      operatingTrend: 0,
      opCategoryCount: 0,
      netProfit: 0,
      netProfitFmt: zero,
      netProfitUsdFmt: fmtCurrency('USD', 0),
      netProfitTrend: 0,
      netMarginPct: 0
    },
    statement: [],
    totals: { sales: 0, totalCost: 0, profit: 0, salesFmt: zero, totalCostFmt: zero, profitFmt: zero },
    transactionCount: 0,
    revenueTxnCount: 0
  };
}

export function normalizeProfitLossData(raw, currency = 'XAF') {
  const base = emptyProfitLossData(currency);
  if (!raw || typeof raw !== 'object') return base;

  return {
    kpis: { ...base.kpis, ...(raw.kpis || {}) },
    statement: Array.isArray(raw.statement) ? raw.statement : [],
    totals: { ...base.totals, ...(raw.totals || {}) },
    transactionCount: raw.transactionCount ?? 0,
    revenueTxnCount: raw.revenueTxnCount ?? 0
  };
}
