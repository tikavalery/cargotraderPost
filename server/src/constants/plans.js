/** Subscription plan definitions — keep in sync with client/src/constants/plans.js */

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

export const PLAN_CATALOG = {
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
    priceYearly: 182.4, // $19 × 12 × 0.8 (20% off)
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
    priceYearly: 278.4, // $29 × 12 × 0.8 (20% off)
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
    priceYearly: 470.4, // $49 × 12 × 0.8
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

export const FEATURE_LABELS = {
  inventoryItems: 'Inventory Items',
  warehouses: 'Warehouses',
  purchases: 'Purchases & Sourcing',
  shipping: 'Shipping Management',
  pos: 'POS / Stores & Sales',
  staffAccounts: 'Users & Staff Accounts',
  purchaseAiFill: 'AI Assistants (Purchase & Expense)'
};

export function getPlan(planId) {
  return PLAN_CATALOG[planId] || PLAN_CATALOG.free;
}

export function planHasFeature(planId, featureKey) {
  const plan = getPlan(planId);
  if (featureKey === 'inventoryItems' || featureKey === 'warehouses') return true;
  return Boolean(plan.features[featureKey]);
}

export function getPlanLimit(planId, limitKey) {
  const plan = getPlan(planId);
  const envKey = `PLAN_LIMIT_${String(planId).toUpperCase()}_${String(limitKey).toUpperCase()}`;
  const envVal = process.env[envKey];
  if (envVal !== undefined && envVal !== '') {
    if (envVal === 'unlimited' || envVal === 'null') return null;
    const n = Number(envVal);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return plan.limits[limitKey] ?? null;
}

export function formatLimitFeature(limitKey, limit) {
  if (limit == null) return 'Unlimited';
  const n = Number(limit);
  const pretty = Number.isFinite(n) ? n.toLocaleString('en-US') : String(limit);
  if (limitKey === 'inventoryItems') return `${pretty} item${limit === 1 ? '' : 's'}`;
  if (limitKey === 'warehouses') return limit === 1 ? '1 warehouse' : `Up to ${pretty}`;
  if (limitKey === 'users') return limit === 1 ? '1 user' : `Up to ${pretty}`;
  if (limitKey === 'shipmentsPerYear') {
    return limit === 1 ? '1 shipment/year' : `${pretty} shipments/year`;
  }
  if (limitKey === 'stores') return limit === 1 ? '1 store' : `Up to ${pretty} stores`;
  if (limitKey === 'aiAnalysesPerMonth') {
    if (limit === 0) return '—';
    return `${pretty}/month`;
  }
  return pretty;
}

function formatModuleFeature(plan, featureKey, limitKey) {
  if (!plan.features[featureKey]) return '—';
  const limit = getPlanLimit(plan.id, limitKey);
  if (limitKey === 'aiAnalysesPerMonth') {
    if (limit === 0) return '—';
    if (limit == null) return 'Unlimited';
    return formatLimitFeature(limitKey, limit);
  }
  if (limit != null) return formatLimitFeature(limitKey, limit);
  return 'Included';
}

export function formatPlanForClient(planId, subscription = {}) {
  const displayId = subscription.plan || planId || 'free';
  const displayPlan = getPlan(displayId);
  const limits = {
    inventoryItems: getPlanLimit(planId, 'inventoryItems'),
    warehouses: getPlanLimit(planId, 'warehouses'),
    users: getPlanLimit(planId, 'users'),
    shipmentsPerYear: getPlanLimit(planId, 'shipmentsPerYear'),
    stores: getPlanLimit(planId, 'stores'),
    aiAnalysesPerMonth: getPlanLimit(planId, 'aiAnalysesPerMonth')
  };
  const features = {
    ...displayPlan.features,
    inventoryItems: formatLimitFeature('inventoryItems', limits.inventoryItems),
    warehouses: formatLimitFeature('warehouses', limits.warehouses),
    purchases: getPlan(planId).features.purchases ? 'Included' : '—',
    shipping: formatModuleFeature({ ...getPlan(planId), id: planId }, 'shipping', 'shipmentsPerYear'),
    pos: formatModuleFeature({ ...getPlan(planId), id: planId }, 'pos', 'stores'),
    purchaseAiFill: formatModuleFeature(
      { ...getPlan(planId), id: planId },
      'purchaseAiFill',
      'aiAnalysesPerMonth'
    )
  };

  const gracePeriodEnd =
    subscription.gracePeriodEnd && !Number.isNaN(new Date(subscription.gracePeriodEnd).getTime())
      ? subscription.gracePeriodEnd
      : null;
  const isPastDue = subscription.status === 'past_due';
  let graceDaysRemaining = null;
  if (isPastDue && gracePeriodEnd) {
    graceDaysRemaining = Math.max(
      0,
      Math.ceil((new Date(gracePeriodEnd).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    );
  }

  const trialPeriodDays = getPublicTrialPeriodDays();
  const isTrialing = subscription.status === 'trialing';

  return {
    id: displayId,
    name: displayPlan.name,
    tagline: displayPlan.tagline,
    priceMonthly: displayPlan.priceMonthly,
    priceYearly: displayPlan.priceYearly,
    popular: displayPlan.popular,
    limits,
    features,
    featureLabels: FEATURE_LABELS,
    status: subscription.status || 'active',
    isPastDue,
    isTrialing,
    trialPeriodDays,
    gracePeriodEnd,
    graceDaysRemaining,
    featurePlanId: planId,
    billingInterval: subscription.billingInterval || null,
    currentPeriodEnd: subscription.currentPeriodEnd && !Number.isNaN(new Date(subscription.currentPeriodEnd).getTime())
      ? subscription.currentPeriodEnd
      : null,
    cancelAtPeriodEnd: Boolean(subscription.cancelAtPeriodEnd),
    pendingPlan: subscription.pendingPlan || null,
    pendingPlanName: subscription.pendingPlan ? getPlan(subscription.pendingPlan).name : null,
    stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    /** True when this business already has a Stripe customer or subscription id linked. */
    stripeLinked: Boolean(subscription.stripeCustomerId || subscription.stripeSubscriptionId)
  };
}

/** Trial days advertised on the pricing page (0 = trials disabled). */
export function getPublicTrialPeriodDays() {
  const raw = process.env.STRIPE_TRIAL_PERIOD_DAYS;
  if (raw === undefined || raw === '') return 7;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.floor(n), 730);
}

export function publicPlansPayload() {
  const trialPeriodDays = getPublicTrialPeriodDays();
  return PLAN_IDS.map((id) => ({
    ...formatPlanForClient(id),
    trialPeriodDays: id === 'free' ? 0 : trialPeriodDays
  }));
}
