import Stripe from 'stripe';
import { getPlan } from '../constants/plans.js';

let stripeClient = null;

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  // Windows antivirus / SSL inspection can break Stripe API TLS in local dev
  if (
    process.env.NODE_ENV !== 'production' &&
    process.env.STRIPE_TLS_REJECT_UNAUTHORIZED === 'false'
  ) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }
  if (!stripeClient) stripeClient = new Stripe(key);
  return stripeClient;
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** True when env holds a real Stripe Price ID (not a placeholder like price_xxx). */
export function isConfiguredStripePriceId(priceId) {
  if (!priceId || typeof priceId !== 'string') return false;
  const value = priceId.trim();
  if (!value || value.includes('xxx') || value.includes('...')) return false;
  return /^price_[A-Za-z0-9]+$/.test(value);
}

/** Resolve Stripe Price ID from env, or null to use dynamic price_data. */
export function resolveStripePriceId(planId, interval) {
  const envKey = `STRIPE_PRICE_${planId.toUpperCase()}_${interval === 'year' ? 'YEARLY' : 'MONTHLY'}`;
  const value = process.env[envKey];
  return isConfiguredStripePriceId(value) ? value.trim() : null;
}

/** Map a Stripe Price ID back to planId using STRIPE_PRICE_* env vars. */
export function planIdFromStripePriceId(priceId) {
  if (!priceId) return null;
  for (const planId of ['enterprise', 'professional_plus', 'professional']) {
    for (const interval of ['month', 'year']) {
      if (resolveStripePriceId(planId, interval) === priceId) return planId;
    }
  }
  return null;
}

/** Checkout Sessions accept product_data inside price_data. */
function checkoutPriceSpec(planId, interval) {
  const priceId = resolveStripePriceId(planId, interval);
  if (priceId) return { price: priceId };

  const plan = getPlan(planId);
  const unitAmount =
    interval === 'year'
      ? Math.round(plan.priceYearly * 100)
      : Math.round(plan.priceMonthly * 100);

  return {
    price_data: {
      currency: 'usd',
      unit_amount: unitAmount,
      recurring: { interval: interval === 'year' ? 'year' : 'month' },
      product_data: {
        name: `CargoTrader ${plan.name}`,
        description: plan.tagline
      }
    }
  };
}

function buildLineItem(planId, interval) {
  return { ...checkoutPriceSpec(planId, interval), quantity: 1 };
}

const productIdCache = new Map();

/** Find or create a Stripe Product for plan downgrades / subscription item updates. */
async function resolveOrCreateStripeProduct(planId) {
  if (productIdCache.has(planId)) return productIdCache.get(planId);

  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe is not configured');

  const plan = getPlan(planId);
  const name = `CargoTrader ${plan.name}`;
  const envKey = `STRIPE_PRODUCT_${planId.toUpperCase()}`;
  const envProduct = process.env[envKey]?.trim();
  if (envProduct?.startsWith('prod_')) {
    productIdCache.set(planId, envProduct);
    return envProduct;
  }

  const products = await stripe.products.list({ active: true, limit: 100 });
  const match = products.data.find((p) => p.name === name || p.metadata?.planId === planId);
  if (match) {
    productIdCache.set(planId, match.id);
    return match.id;
  }

  const created = await stripe.products.create({
    name,
    description: plan.tagline,
    metadata: { planId }
  });
  productIdCache.set(planId, created.id);
  return created.id;
}

/**
 * Subscription item updates require price_data.product (id), not product_data.
 * Used for paid-to-paid downgrades at period end.
 */
export async function resolveSubscriptionItemPriceSpec(planId, interval) {
  const priceId = resolveStripePriceId(planId, interval);
  if (priceId) return { price: priceId };

  const plan = getPlan(planId);
  const productId = await resolveOrCreateStripeProduct(planId);
  const unitAmount =
    interval === 'year'
      ? Math.round(plan.priceYearly * 100)
      : Math.round(plan.priceMonthly * 100);

  return {
    price_data: {
      currency: 'usd',
      product: productId,
      unit_amount: unitAmount,
      recurring: { interval: interval === 'year' ? 'year' : 'month' }
    }
  };
}

/**
 * Free trial length for first paid Checkout (days).
 * Set STRIPE_TRIAL_PERIOD_DAYS=0 (or empty) to disable. Default: 7.
 */
export function getStripeTrialPeriodDays() {
  const raw = process.env.STRIPE_TRIAL_PERIOD_DAYS;
  if (raw === undefined || raw === '') return 7;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.floor(n), 730);
}

/**
 * True if this Stripe customer already had a real subscription (trial/paid).
 * Used so free trials apply only once.
 */
export async function customerHasUsedPaidSubscription(customerId) {
  const stripe = getStripe();
  if (!stripe || !customerId) return false;

  try {
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 20
    });
    return subs.data.some((s) =>
      ['active', 'trialing', 'past_due', 'canceled', 'unpaid'].includes(s.status)
    );
  } catch (err) {
    console.warn('[stripe] trial eligibility check failed:', err.message);
    return true; // fail closed — no trial if we cannot verify
  }
}

export async function createCheckoutSession({
  businessId,
  userId,
  userEmail,
  planId,
  interval = 'month',
  customerId,
  trialPeriodDays
}) {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe is not configured');

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const days =
    trialPeriodDays === undefined || trialPeriodDays === null
      ? getStripeTrialPeriodDays()
      : Number(trialPeriodDays) || 0;

  const origin = clientUrl.replace(/\/$/, '');
  const automaticTax = isStripeAutomaticTaxEnabled();

  const sessionParams = {
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [buildLineItem(planId, interval)],
    success_url: `${origin}/pricing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing?checkout=canceled`,
    client_reference_id: String(businessId),
    billing_address_collection: 'required',
    metadata: {
      businessId: String(businessId),
      userId: String(userId),
      planId,
      interval,
      billingCurrency: 'usd',
      ...(days > 0 ? { trialPeriodDays: String(days) } : {})
    },
    subscription_data: {
      metadata: {
        businessId: String(businessId),
        planId
      }
    },
    custom_text: {
      submit: {
        message:
          'Subscription fees are billed in United States dollars (USD). In-app inventory and POS amounts may use your preferred currency (for example XAF).'
      }
    }
  };

  if (automaticTax) {
    sessionParams.automatic_tax = { enabled: true };
    sessionParams.tax_id_collection = { enabled: true };
  }

  if (days > 0) {
    sessionParams.subscription_data.trial_period_days = days;
    // Collect a payment method up front so billing continues after the trial ends
    sessionParams.payment_method_collection = 'always';
    console.log(
      `[stripe] checkout with ${days}-day trial for business ${businessId} → ${planId}`
    );
  }

  if (customerId) {
    sessionParams.customer = customerId;
    // Required for automatic_tax when reusing an existing Customer
    sessionParams.customer_update = { address: 'auto', name: 'auto' };
  } else if (userEmail) {
    sessionParams.customer_email = userEmail;
  }

  return stripe.checkout.sessions.create(sessionParams);
}

/** Stripe Tax at Checkout — enable in Dashboard, then set STRIPE_AUTOMATIC_TAX=true. */
export function isStripeAutomaticTaxEnabled() {
  const flag = (process.env.STRIPE_AUTOMATIC_TAX || '').trim().toLowerCase();
  return flag === 'true' || flag === '1' || flag === 'yes';
}

export function constructWebhookEvent(rawBody, signature) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) throw new Error('Stripe webhook is not configured');
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

export async function retrieveSubscription(stripeSubscriptionId) {
  const stripe = getStripe();
  if (!stripe || !stripeSubscriptionId) return null;
  try {
    return await stripe.subscriptions.retrieve(stripeSubscriptionId, {
      expand: ['items.data.price.product']
    });
  } catch (err) {
    if (err?.statusCode === 404 || err?.code === 'resource_missing') return null;
    throw err;
  }
}

export async function retrieveCheckoutSession(sessionId) {
  const stripe = getStripe();
  if (!stripe) return null;
  return stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription']
  });
}

/** Schedule Stripe subscription cancellation at end of current billing period. */
export async function cancelSubscriptionAtPeriodEnd(stripeSubscriptionId) {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe is not configured');
  return stripe.subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: true });
}

/** Cancel Stripe subscription immediately (e.g. after grace period expires). */
export async function cancelSubscriptionImmediately(stripeSubscriptionId) {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe is not configured');
  return stripe.subscriptions.cancel(stripeSubscriptionId);
}

/**
 * Downgrade paid plan at next billing cycle (e.g. Enterprise → Professional).
 * Uses STRIPE_PRICE_* env IDs when set, otherwise dynamic price_data (same as checkout).
 */
export async function changeSubscriptionPlanAtPeriodEnd(stripeSubscriptionId, targetPlanId, billingInterval = 'month') {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe is not configured');

  const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const itemId = sub.items.data[0]?.id;
  const interval = billingInterval === 'year' ? 'year' : 'month';

  if (!itemId) {
    throw new Error('Could not find subscription item to update');
  }

  const priceSpec = await resolveSubscriptionItemPriceSpec(targetPlanId, interval);

  return stripe.subscriptions.update(stripeSubscriptionId, {
    items: [{ id: itemId, ...priceSpec }],
    proration_behavior: 'none',
    cancel_at_period_end: false,
    metadata: {
      ...sub.metadata,
      planId: targetPlanId,
      businessId: sub.metadata?.businessId || ''
    }
  });
}

/**
 * Upgrade / switch plan immediately on an existing Stripe subscription (no new Checkout).
 * Clears cancel_at_period_end and applies proration for upgrades.
 */
export async function changeSubscriptionPlanNow(
  stripeSubscriptionId,
  targetPlanId,
  billingInterval = 'month',
  { businessId } = {}
) {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe is not configured');

  const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const itemId = sub.items.data[0]?.id;
  const interval = billingInterval === 'year' ? 'year' : 'month';

  if (!itemId) {
    throw new Error('Could not find subscription item to update');
  }

  if (!['active', 'trialing', 'past_due'].includes(sub.status)) {
    throw new Error(`Cannot update subscription in status "${sub.status}"`);
  }

  const priceSpec = await resolveSubscriptionItemPriceSpec(targetPlanId, interval);
  console.log(
    `[stripe] updating subscription ${stripeSubscriptionId} → ${targetPlanId}/${interval} (was ${sub.status})`
  );

  return stripe.subscriptions.update(stripeSubscriptionId, {
    items: [{ id: itemId, ...priceSpec }],
    proration_behavior: 'create_prorations',
    cancel_at_period_end: false,
    metadata: {
      ...sub.metadata,
      planId: targetPlanId,
      businessId: businessId ? String(businessId) : sub.metadata?.businessId || ''
    }
  });
}

/** Cancel extra Stripe subscriptions so a business only keeps one active/paid sub. */
export async function cancelDuplicateStripeSubscriptions(keepSubscriptionId, candidates = []) {
  const stripe = getStripe();
  if (!stripe || !keepSubscriptionId) return { canceled: [] };

  const canceled = [];
  for (const entry of candidates) {
    const stripeSub = entry?.stripeSub || entry;
    const id = stripeSub?.id;
    if (!id || id === keepSubscriptionId) continue;
    if (!['active', 'trialing', 'past_due', 'unpaid', 'incomplete'].includes(stripeSub.status)) {
      continue;
    }
    try {
      await stripe.subscriptions.cancel(id);
      canceled.push(id);
      console.log(`[stripe] canceled duplicate subscription ${id} (kept ${keepSubscriptionId})`);
    } catch (err) {
      console.warn(`[stripe] failed to cancel duplicate ${id}:`, err.message);
    }
  }
  return { canceled };
}

/** Cached portal configuration ID (created once per process if not in env). */
let cachedPortalConfigId = null;

/**
 * Stripe Customer Portal configuration — enables payment method updates,
 * subscription cancellation, and invoice history.
 * Set STRIPE_PORTAL_CONFIGURATION_ID in .env to use a Dashboard-managed config.
 */
export async function resolvePortalConfigurationId() {
  if (process.env.STRIPE_PORTAL_CONFIGURATION_ID) {
    return process.env.STRIPE_PORTAL_CONFIGURATION_ID;
  }
  if (cachedPortalConfigId) return cachedPortalConfigId;

  if (process.env.NODE_ENV === 'production') {
    console.warn(
      '[stripe portal] STRIPE_PORTAL_CONFIGURATION_ID is unset — auto-creating/updating a portal configuration. Pin an ID from the Stripe Dashboard for production.'
    );
  }

  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe is not configured');

  const portalFeatures = {
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ['price'],
      proration_behavior: 'create_prorations'
    },
    subscription_cancel: {
      enabled: true,
      mode: 'at_period_end',
      cancellation_reason: {
        enabled: true,
        options: ['too_expensive', 'missing_features', 'switched_service', 'unused', 'other']
      }
    }
  };

  const existing = await stripe.billingPortal.configurations.list({ limit: 1 });
  if (existing.data.length) {
    const configId = existing.data[0].id;
    try {
      await stripe.billingPortal.configurations.update(configId, { features: portalFeatures });
    } catch (err) {
      console.warn('[stripe portal] could not enable subscription_update on existing config:', err.message);
    }
    cachedPortalConfigId = configId;
    return cachedPortalConfigId;
  }

  const config = await stripe.billingPortal.configurations.create({
    business_profile: {
      headline: 'CargoTrader — Billing'
    },
    features: portalFeatures
  });

  cachedPortalConfigId = config.id;
  return cachedPortalConfigId;
}

/** Restrict return URLs to the app origin (CLIENT_URL). */
export function sanitizePortalReturnUrl(returnUrl) {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const fallback = `${clientUrl.replace(/\/$/, '')}/pricing?portal=return`;
  if (!returnUrl || typeof returnUrl !== 'string') return fallback;

  try {
    const base = new URL(clientUrl);
    const target = new URL(returnUrl, base);
    if (target.origin !== base.origin) return fallback;
    return target.href;
  } catch {
    return fallback;
  }
}

/**
 * Open Stripe Customer Portal for card updates, cancellation, and invoices.
 */
export async function createPortalSession({ customerId, returnUrl }) {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe is not configured');
  if (!customerId) throw new Error('Stripe customer id is required');

  const configuration = await resolvePortalConfigurationId();
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: sanitizePortalReturnUrl(returnUrl),
    configuration
  });
}

/**
 * Resolve Stripe customer id for a business (local record, subscription, or email lookup).
 */
export async function resolveStripeCustomerId(businessId, userEmail) {
  const { default: Subscription } = await import('../models/Subscription.js');

  const local = await Subscription.findOne({ business: businessId });
  if (local?.stripeCustomerId) return local.stripeCustomerId;

  if (local?.stripeSubscriptionId) {
    const stripeSub = await retrieveSubscription(local.stripeSubscriptionId);
    if (stripeSub) {
      const customerId =
        typeof stripeSub.customer === 'string' ? stripeSub.customer : stripeSub.customer?.id;
      if (customerId) {
        local.stripeCustomerId = customerId;
        await local.save();
        return customerId;
      }
    }
  }

  const stripe = getStripe();
  if (!stripe || !userEmail) return null;

  const customers = await stripe.customers.list({ email: userEmail, limit: 20 });
  for (const customer of customers.data) {
    const subs = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'all',
      limit: 10
    });
    const match = subs.data.find(
      (s) => s.metadata?.businessId && String(s.metadata.businessId) === String(businessId)
    );
    if (match) {
      if (local) {
        local.stripeCustomerId = customer.id;
        await local.save();
      }
      return customer.id;
    }
  }

  return null;
}
