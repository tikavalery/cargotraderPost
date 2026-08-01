/** Client-side plan helpers — mirrors server/src/constants/plans.js */

/** Default translator: interpolate `{name}` placeholders (English keys). */
function identityT(key, vars) {
  if (!vars) return key;
  return String(key).replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] != null ? String(vars[k]) : `{${k}}`
  );
}

export const PLAN_IDS = ['free', 'professional', 'professional_plus', 'enterprise'];

export const PLAN_RANK = {
  free: 0,
  professional: 1,
  professional_plus: 2,
  enterprise: 3
};

export function isPlanDowngrade(fromPlanId, toPlanId) {
  return (PLAN_RANK[toPlanId] ?? 0) < (PLAN_RANK[fromPlanId] ?? 0);
}

export const FEATURE_ROWS = [
  { key: 'inventoryItems', label: 'Inventory Items' },
  { key: 'warehouses', label: 'Warehouses' },
  { key: 'purchases', label: 'Purchases & Sourcing', type: 'boolean' },
  { key: 'shipping', label: 'Shipping Management', type: 'boolean', limitKey: 'shipmentsPerYear' },
  { key: 'pos', label: 'POS / Stores & Sales', type: 'boolean', limitKey: 'stores' },
  { key: 'staffAccounts', label: 'Users & Staff Accounts', type: 'boolean' },
  { key: 'purchaseAiFill', label: 'AI Assistants (Purchase & Expense)', type: 'boolean', limitKey: 'aiAnalysesPerMonth' }
];

export const STATIC_PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Get started with core inventory tools',
    priceMonthly: 0,
    priceYearly: 0,
    popular: false,
    limits: {
      inventoryItems: 100,
      warehouses: 1,
      users: 2,
      shipmentsPerYear: 1,
      stores: 1,
      aiAnalysesPerMonth: 0
    },
    features: {
      inventoryItems: '100 items',
      warehouses: '1 warehouse',
      purchases: true,
      shipping: true,
      pos: true,
      staffAccounts: true,
      purchaseAiFill: false
    }
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    tagline: '3,000 inventory · 5 warehouses · 5 stores · 6,000 AI/month',
    priceMonthly: 19,
    priceYearly: 182.4,
    popular: true,
    limits: {
      inventoryItems: 3000,
      warehouses: 5,
      users: 15,
      shipmentsPerYear: null,
      stores: 5,
      aiAnalysesPerMonth: 6000
    },
    features: {
      inventoryItems: '3,000 items',
      warehouses: 'Up to 5',
      purchases: true,
      shipping: true,
      pos: true,
      staffAccounts: true,
      purchaseAiFill: true
    }
  },
  professional_plus: {
    id: 'professional_plus',
    name: 'Professional Plus',
    tagline: '10,000 inventory · 10 warehouses · 10 stores · 20,000 AI/month',
    priceMonthly: 29,
    priceYearly: 278.4,
    popular: false,
    limits: {
      inventoryItems: 10000,
      warehouses: 10,
      users: 15,
      shipmentsPerYear: null,
      stores: 10,
      aiAnalysesPerMonth: 20000
    },
    features: {
      inventoryItems: '10,000 items',
      warehouses: 'Up to 10',
      purchases: true,
      shipping: true,
      pos: true,
      staffAccounts: true,
      purchaseAiFill: true
    }
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Unlimited scale for multi-location teams',
    priceMonthly: 49,
    priceYearly: 470.4,
    popular: false,
    limits: {
      inventoryItems: null,
      warehouses: null,
      users: null,
      shipmentsPerYear: null,
      stores: null,
      aiAnalysesPerMonth: null
    },
    features: {
      inventoryItems: 'Unlimited',
      warehouses: 'Unlimited',
      purchases: true,
      shipping: true,
      pos: true,
      staffAccounts: true,
      purchaseAiFill: true
    }
  }
};

export function yearlyMonthlyEquivalent(plan) {
  return plan.priceYearly / 12;
}

export function displayPrice(plan, interval, t = identityT) {
  if (plan.priceMonthly === 0) return { amount: 0, suffix: '', billed: t('Free forever') };
  if (interval === 'year') {
    return {
      amount: yearlyMonthlyEquivalent(plan),
      suffix: t('/mo USD'),
      billed: t('{amount} USD/year billed annually', {
        amount: `$${plan.priceYearly.toFixed(0)}`
      })
    };
  }
  return { amount: plan.priceMonthly, suffix: t('/mo USD'), billed: t('Billed monthly in USD') };
}

export function planHasFeature(plan, featureKey) {
  if (!plan?.features) return false;
  if (featureKey === 'inventoryItems' || featureKey === 'warehouses') return true;
  const val = plan.features[featureKey];
  if (val === '—' || val === false) return false;
  if (typeof val === 'boolean') return val;
  return Boolean(val);
}

export function isCurrentPlan(current, planId) {
  return current?.id === planId;
}

/** Format subscription period end to match Stripe billing dates (UTC calendar day). */
export function formatBillingDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

/**
 * @param {(key: string, vars?: Record<string, string|number>) => string} [t]
 * @param {string} [locale] BCP-47 locale for number formatting
 */
export function featureDisplay(plan, row, t = identityT, locale = 'en-US') {
  const num = (n) => Number(n).toLocaleString(locale);
  if (row.key === 'inventoryItems') {
    if (plan.limits?.inventoryItems != null) {
      const n = plan.limits.inventoryItems;
      return n === 1 ? t('{n} item', { n: num(n) }) : t('{n} items', { n: num(n) });
    }
    const raw = plan.features?.inventoryItems || 'Unlimited';
    return t(raw);
  }
  if (row.key === 'warehouses' && plan.limits?.warehouses != null) {
    const n = plan.limits.warehouses;
    return n === 1 ? t('1 warehouse') : t('Up to {n}', { n: num(n) });
  }
  if (row.key === 'shipping' && plan.limits?.shipmentsPerYear != null) {
    const n = plan.limits.shipmentsPerYear;
    return n === 1
      ? t('1 shipment/year')
      : t('{n} shipments/year', { n: num(n) });
  }
  if (row.key === 'pos' && plan.limits?.stores != null) {
    const n = plan.limits.stores;
    return n === 1 ? t('1 store') : t('Up to {n} stores', { n: num(n) });
  }
  if (row.key === 'purchaseAiFill') {
    if (!planHasFeature(plan, 'purchaseAiFill')) return '—';
    const n = plan.limits?.aiAnalysesPerMonth;
    if (n === 0) return '—';
    if (n == null) return t('Unlimited');
    return t('{n}/month', { n: num(n) });
  }
  const val = plan.features?.[row.key];
  if (row.type === 'boolean') {
    if (val === '—' || val === false) return '—';
    if (typeof val === 'string' && val !== 'Included') return t(val);
    return val ? t('Included') : '—';
  }
  return val ? t(String(val)) : '—';
}

/** Merge API plan payload with static catalog — never let API `null` wipe a numeric catalog cap. */
export function mergePlanFromApi(apiPlan) {
  const base = STATIC_PLANS[apiPlan?.id] || {};
  const limits = { ...(base.limits || {}) };
  for (const [key, value] of Object.entries(apiPlan?.limits || {})) {
    if (value === null && typeof limits[key] === 'number') continue;
    limits[key] = value;
  }
  return {
    ...base,
    ...apiPlan,
    limits,
    features: {
      ...(base.features || {}),
      ...(apiPlan?.features || {}),
      inventoryItems:
        limits.inventoryItems != null
          ? `${Number(limits.inventoryItems).toLocaleString('en-US')} item${
              limits.inventoryItems === 1 ? '' : 's'
            }`
          : apiPlan?.features?.inventoryItems || base.features?.inventoryItems,
      purchaseAiFill:
        !base.features?.purchaseAiFill && !apiPlan?.features?.purchaseAiFill
          ? false
          : limits.aiAnalysesPerMonth === 0
            ? false
            : limits.aiAnalysesPerMonth == null
              ? apiPlan?.features?.purchaseAiFill || 'Unlimited'
              : `${Number(limits.aiAnalysesPerMonth).toLocaleString('en-US')}/month`
    }
  };
}
