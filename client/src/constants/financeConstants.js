import { CURRENCY_SYMBOLS, XAF_PER_UNIT } from '../theme/authConstants.js';
import { groupDigits } from '../utils/numberFormat';

export const COGS_EXPENSE_CATEGORIES = [
  'Goods / COGS',
  'Freight & Shipping',
  'Customs & Duties'
];

export const OPERATING_EXPENSE_CATEGORIES = [
  'Salaries & Wages',
  'Rent / Storage',
  'Utilities & Internet',
  'Marketing & Advertising',
  'Insurance',
  'Vehicle / Delivery',
  'Office / Software Supplies',
  'Others (repairs, fees, misc.)'
];

export const BELOW_LINE_EXPENSE_CATEGORIES = [
  'Interest Expense',
  'Taxes (estimated)'
];

export const EXPENSE_CATEGORIES = [
  ...COGS_EXPENSE_CATEGORIES,
  ...OPERATING_EXPENSE_CATEGORIES,
  ...BELOW_LINE_EXPENSE_CATEGORIES
];

export const EXPENSE_CATEGORY_GROUPS = [
  { label: 'Cost of Goods Sold', options: COGS_EXPENSE_CATEGORIES },
  { label: 'Operating Expenses', options: OPERATING_EXPENSE_CATEGORIES },
  { label: 'Below the Line', options: BELOW_LINE_EXPENSE_CATEGORIES }
];

export const LEGACY_EXPENSE_CATEGORY_ALIASES = {
  'Wages & Payroll': 'Salaries & Wages',
  'Rent & Utilities': 'Rent / Storage',
  Marketing: 'Marketing & Advertising',
  Equipment: 'Office / Software Supplies',
  Operating: 'Vehicle / Delivery',
  Other: 'Others (repairs, fees, misc.)',
  'POS Refunds': 'Others (repairs, fees, misc.)'
};

export function resolveExpenseCategory(category) {
  const cat = String(category || '').trim();
  return LEGACY_EXPENSE_CATEGORY_ALIASES[cat] || cat;
}

export const REVENUE_SOURCES = ['POS', 'Marketplace', 'Wholesale', 'Shipment Sales', 'Manual', 'Other'];

export const DONUT_COLORS = ['#1A3C5E', '#E85D26', '#F5A623', '#2ECC71', '#9B59B6', '#3498DB'];

export const XAF_PER_USD = XAF_PER_UNIT.USD;

/** Convert a display-currency amount into XAF for storage. */
export function toXaf(amount, currency = 'XAF') {
  const n = Number(amount) || 0;
  const code = String(currency || 'XAF').toUpperCase();
  if (code === 'XAF' || code === 'XOF') return Math.round(n);
  const rate = XAF_PER_UNIT[code] ?? XAF_PER_USD;
  return Math.round(n * rate);
}

/** Convert a stored XAF amount into a display currency. */
export function fromXaf(xaf, currency = 'USD') {
  const n = Number(xaf) || 0;
  const code = String(currency || 'USD').toUpperCase();
  if (code === 'XAF' || code === 'XOF') return Math.round(n);
  const rate = XAF_PER_UNIT[code] ?? XAF_PER_USD;
  return Math.round((n / rate) * 100) / 100;
}

export function fmtCurrency(currency, amountXaf) {
  const code = String(currency || 'XAF').toUpperCase();
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
