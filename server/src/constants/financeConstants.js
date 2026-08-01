export const RATES = { XAF: 600, EUR: 655, GBP: 760, USD_EUR: 0.92 };

export const RATE_DISPLAY = [
  { region: 'CM', pair: 'USD / XAF', rate: 600, flag: '🇨🇲' },
  { region: 'EU', pair: 'EUR / XAF', rate: 655, flag: '🇪🇺' },
  { region: 'US', pair: 'USD / EUR', rate: 0.92, flag: '🇺🇸' },
  { region: 'GB', pair: 'GBP / XAF', rate: 760, flag: '🇬🇧' }
];

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

/** Map retired form labels to current P&L line labels (no amount splitting). */
export const LEGACY_EXPENSE_CATEGORY_ALIASES = {
  'Wages & Payroll': 'Salaries & Wages',
  'Rent & Utilities': 'Rent / Storage',
  Marketing: 'Marketing & Advertising',
  Equipment: 'Office / Software Supplies',
  Operating: 'Vehicle / Delivery',
  Other: 'Others (repairs, fees, misc.)',
  'POS Refunds': 'Others (repairs, fees, misc.)'
};

export const REVENUE_SOURCES = ['POS', 'Marketplace', 'Wholesale', 'Shipment Sales', 'Manual', 'Other'];

export const EXPENSE_GROUPS = {
  Purchases: COGS_EXPENSE_CATEGORIES.filter((c) => c === 'Goods / COGS'),
  Shipping: COGS_EXPENSE_CATEGORIES.filter((c) => c !== 'Goods / COGS'),
  Operating: OPERATING_EXPENSE_CATEGORIES,
  BelowLine: BELOW_LINE_EXPENSE_CATEGORIES
};

export const DONUT_COLORS = ['#1A3C5E', '#E85D26', '#F5A623', '#2ECC71', '#9B59B6', '#3498DB', '#E74C3C', '#16A085'];
