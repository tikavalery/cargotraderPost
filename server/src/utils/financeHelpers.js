import { RATES, LEGACY_EXPENSE_CATEGORY_ALIASES, OPERATING_EXPENSE_CATEGORIES, BELOW_LINE_EXPENSE_CATEGORIES } from '../constants/financeConstants.js';
import { CURRENCY_SYMBOLS, normalizeCurrency, xafPerUnit } from '../constants/currencies.js';
import { groupDigits } from './numberFormat.js';

/** Normalize business id for filters (PostgreSQL string PKs). */
export function toBusinessObjectId(businessId) {
  return businessId == null ? businessId : String(businessId);
}

export function toXaf(amount, currency = 'XAF') {
  const n = Number(amount) || 0;
  const code = normalizeCurrency(currency);
  const rate = xafPerUnit(code);
  if (code === 'XAF' || code === 'XOF') return Math.round(n * rate);
  if (rate >= 10) return Math.round(n * rate);
  return Math.round(n * rate);
}

export function fromXaf(xaf, currency = 'USD') {
  const n = Number(xaf) || 0;
  const code = normalizeCurrency(currency, 'USD');
  if (code === 'XAF' || code === 'XOF') return Math.round(n);
  const rate = xafPerUnit(code);
  if (!rate) return Math.round((n / (RATES.XAF || 600)) * 100) / 100;
  const converted = n / rate;
  return rate >= 10 ? Math.round(converted * 100) / 100 : Math.round(converted * 100) / 100;
}

export function fmtCurrency(currency, amountXaf) {
  const code = normalizeCurrency(currency);
  const amt = fromXaf(amountXaf, code);
  // US/UK grouping: 1,234,567
  const num = groupDigits(amt);
  if (code === 'XAF') return `${num} XAF`;
  if (code === 'XOF') return `${num} XOF`;
  if (code === 'EUR') return `€${num}`;
  if (code === 'GBP') return `£${num}`;
  if (code === 'USD') return `$${num}`;
  const sym = CURRENCY_SYMBOLS[code] || '';
  return `${sym}${num} ${code}`.trim();
}

export function parseDate(d) {
  if (!d) return null;
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? null : t;
}

export function inPeriod(date, period) {
  const d = parseDate(date);
  if (!d) return true;
  const now = new Date();
  if (period === 'year') return d.getFullYear() === now.getFullYear();
  if (period === 'quarter') {
    const q = Math.floor(now.getMonth() / 3);
    return d.getFullYear() === now.getFullYear() && Math.floor(d.getMonth() / 3) === q;
  }
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function inLastMonth(date) {
  const d = parseDate(date);
  if (!d) return true;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  return d >= start && d <= end;
}

export function inCustomRange(date, start, end) {
  const d = parseDate(date);
  if (!d) return true;
  const s = parseDate(start);
  const e = parseDate(end);
  if (s) {
    const startDay = new Date(s);
    startDay.setHours(0, 0, 0, 0);
    if (d < startDay) return false;
  }
  if (e) {
    const endDay = new Date(e);
    endDay.setHours(23, 59, 59, 999);
    if (d > endDay) return false;
  }
  return true;
}

export function inDateRange(date, range) {
  const d = parseDate(date);
  if (!d) return true;
  const bounds = rangeToDateBounds(range);
  if (!bounds) return true;
  if (bounds.$gte && d < bounds.$gte) return false;
  if (bounds.$lte && d > bounds.$lte) return false;
  return true;
}

/**
 * Convert finance range/period/custom dates into Mongo date filter bounds.
 * Returns null when unbounded (avoid full-collection scans when possible).
 */
export function rangeToDateBounds(range, start, end, period) {
  const now = new Date();
  if (range === 'custom') {
    const bounds = {};
    const s = parseDate(start);
    const e = parseDate(end);
    if (s) {
      const startDay = new Date(s);
      startDay.setHours(0, 0, 0, 0);
      bounds.$gte = startDay;
    }
    if (e) {
      const endDay = new Date(e);
      endDay.setHours(23, 59, 59, 999);
      bounds.$lte = endDay;
    }
    return Object.keys(bounds).length ? bounds : null;
  }

  const key = range || period;
  if (!key) return null;

  if (key === 'today') {
    const gte = new Date(now);
    gte.setHours(0, 0, 0, 0);
    const lte = new Date(now);
    lte.setHours(23, 59, 59, 999);
    return { $gte: gte, $lte: lte };
  }
  if (key === 'week') {
    const gte = new Date(now);
    gte.setDate(now.getDate() - 7);
    gte.setHours(0, 0, 0, 0);
    return { $gte: gte, $lte: now };
  }
  if (key === 'month') {
    return {
      $gte: new Date(now.getFullYear(), now.getMonth(), 1),
      $lte: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    };
  }
  if (key === 'last_month') {
    return {
      $gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      $lte: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
    };
  }
  if (key === 'quarter') {
    const q = Math.floor(now.getMonth() / 3);
    return {
      $gte: new Date(now.getFullYear(), q * 3, 1),
      $lte: new Date(now.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999)
    };
  }
  if (key === 'year' || key === 'ytd') {
    return {
      $gte: new Date(now.getFullYear(), 0, 1),
      $lte: new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999)
    };
  }
  return null;
}

/** Mongo filter fragment: { date: { $gte, $lte } } or {}. */
export function rangeToMongoDateFilter(range, start, end, period) {
  const bounds = rangeToDateBounds(range, start, end, period);
  return bounds ? { date: bounds } : {};
}

/** Prior-period window for P&L comparisons (mirrors filterPreviousPeriod). */
export function previousRangeToDateBounds(range) {
  const now = new Date();
  if (range === 'custom') return null;
  if (range === 'today') {
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    const gte = new Date(y);
    gte.setHours(0, 0, 0, 0);
    const lte = new Date(y);
    lte.setHours(23, 59, 59, 999);
    return { $gte: gte, $lte: lte };
  }
  if (range === 'last_month' || range === 'month') {
    return {
      $gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      $lte: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
    };
  }
  if (range === 'quarter') {
    const q = Math.floor(now.getMonth() / 3);
    return {
      $gte: new Date(now.getFullYear(), (q - 1) * 3, 1),
      $lte: new Date(now.getFullYear(), q * 3, 0, 23, 59, 59, 999)
    };
  }
  if (range === 'ytd' || range === 'year') {
    return {
      $gte: new Date(now.getFullYear() - 1, 0, 1),
      $lte: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999)
    };
  }
  return null;
}

export function normalizeSource(src) {
  const raw = String(src || '').trim();
  const known = ['POS', 'Marketplace', 'Wholesale', 'Shipment Sales', 'Manual', 'Other'];
  const exact = known.find((k) => k.toLowerCase() === raw.toLowerCase());
  if (exact) return exact;
  const s = raw.toLowerCase();
  if (s.includes('pos')) return 'POS';
  if (s.includes('market')) return 'Marketplace';
  if (s.includes('wholesale')) return 'Wholesale';
  if (s.includes('ship')) return 'Shipment Sales';
  if (s.includes('manual')) return 'Manual';
  return raw || 'Other';
}

export function canonicalizeExpenseCategory(category) {
  const cat = String(category || '').trim();
  return LEGACY_EXPENSE_CATEGORY_ALIASES[cat] || cat;
}

export function normalizeExpenseGroup(category, source) {
  const cat = canonicalizeExpenseCategory(category);
  const src = String(source || '');
  if (src === 'Purchases' || src === 'Inventory' || cat === 'Goods / COGS') return 'Purchases';
  if (src === 'Shipping' || cat === 'Freight & Shipping' || cat === 'Customs & Duties') return 'Shipping';
  if (OPERATING_EXPENSE_CATEGORIES.includes(cat)) return 'Operating';
  if (BELOW_LINE_EXPENSE_CATEGORIES.includes(cat)) return 'BelowLine';
  return 'Other';
}

export function convertAmount(amount, from, to) {
  const xaf = toXaf(amount, from);
  if (normalizeCurrency(to) === 'XAF') return xaf;
  return fromXaf(xaf, to);
}

export function monthKey(date) {
  const d = parseDate(date) || new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function last6Months() {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}
