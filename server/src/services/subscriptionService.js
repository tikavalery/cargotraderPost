import Subscription from '../models/Subscription.js';
import Item from '../models/Item.js';
import Shipment from '../models/Shipment.js';
import Store from '../models/Store.js';
import { Warehouse } from '../models/Warehouse.js';
import Business from '../models/Business.js';
import StaffInvitation from '../models/StaffInvitation.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { effectivePlanId } from '../utils/planHelpers.js';
import {
  cancelDuplicateStripeSubscriptions,
  cancelSubscriptionAtPeriodEnd,
  cancelSubscriptionImmediately,
  changeSubscriptionPlanAtPeriodEnd,
  changeSubscriptionPlanNow,
  createCheckoutSession,
  createPortalSession,
  customerHasUsedPaidSubscription,
  getStripe,
  getStripeTrialPeriodDays,
  isStripeConfigured,
  planIdFromStripePriceId,
  resolveStripeCustomerId,
  resolveStripePriceId,
  retrieveSubscription
} from './stripeService.js';
import { inventoryItemLimitQuery } from '../utils/inventoryLimitFilter.js';
import {
  formatPlanForClient,
  getPlan,
  getPlanLimit,
  isPlanDowngrade,
  PLAN_IDS,
  PLAN_RANK,
  planHasFeature,
  publicPlansPayload
} from '../constants/plans.js';
import { overLimitCreateMessage } from '../constants/planLimitPolicy.js';
import {
  notifyPaymentFailed,
  notifyPaymentReceipt,
  notifyPlanDowngrade
} from './billingEmail.service.js';

export { effectivePlanId };

/** Days of premium access after a failed payment before downgrade to Free */
export const PAYMENT_GRACE_PERIOD_DAYS = 7;

/** Sync gracePeriodEnd to all users in this business (User model mirror). */
export async function syncGracePeriodToUsers(businessId, gracePeriodEnd) {
  if (!businessId) return;
  const end = gracePeriodEnd ? coerceValidDate(gracePeriodEnd) : null;
  const { updateGracePeriodForBusinessUsers } = await import('../utils/userBusinessQuery.js');
  await updateGracePeriodForBusinessUsers(businessId, end);
}

/** Resolve business id from a Stripe invoice. */
export async function resolveBusinessFromStripeInvoice(invoice) {
  const stripeSubId =
    typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
  if (stripeSubId) {
    const local = await Subscription.findOne({ stripeSubscriptionId: stripeSubId });
    if (local) return local.business;
  }
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (customerId) {
    const local = await Subscription.findOne({ stripeCustomerId: customerId });
    if (local) return local.business;
  }
  return null;
}

/** Start 7-day grace period after payment failure — status past_due, premium disabled. */
export async function startPaymentGracePeriod(businessId, { invoice = null } = {}) {
  const sub = await ensureBusinessSubscription(businessId);
  if (sub.plan === 'free') return sub;

  const newlyFailed = sub.status !== 'past_due';
  if (!sub.gracePeriodEnd || newlyFailed) {
    sub.gracePeriodEnd = new Date(Date.now() + PAYMENT_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
  }
  sub.status = 'past_due';
  await sub.save();
  await syncGracePeriodToUsers(businessId, sub.gracePeriodEnd);

  if (newlyFailed) {
    notifyPaymentFailed(businessId, {
      planId: sub.plan,
      gracePeriodEnd: sub.gracePeriodEnd,
      invoice
    }).catch((err) => console.error('[billing-email] payment_failed notify:', err.message));
  }
  return sub;
}

/** Clear grace period when payment succeeds or subscription recovers. */
export async function clearPaymentGracePeriod(businessId) {
  const sub = await ensureBusinessSubscription(businessId);
  sub.status = 'active';
  sub.gracePeriodEnd = null;
  await sub.save();
  await syncGracePeriodToUsers(businessId, null);
  return sub;
}

/**
 * If grace period has expired, cancel Stripe subscription and downgrade to Free.
 * Called lazily on subscription reads and from webhooks.
 */
export async function enforceGracePeriodExpiry(businessId) {
  const sub = await Subscription.findOne({ business: businessId });
  if (!sub || sub.status !== 'past_due' || !sub.gracePeriodEnd) return sub;

  const graceEnd = coerceValidDate(sub.gracePeriodEnd);
  if (!graceEnd || new Date() < graceEnd) return sub;

  const fromPlanId = sub.plan;
  if (sub.stripeSubscriptionId && isStripeConfigured()) {
    try {
      await cancelSubscriptionImmediately(sub.stripeSubscriptionId);
    } catch (err) {
      console.error('[payment grace] Stripe cancel failed:', err.message);
    }
  }

  await downgradeToFree(businessId, { reason: 'grace_expired', fromPlanId });
  return Subscription.findOne({ business: businessId });
}

/** Stripe webhook: invoice.payment_failed */
export async function handleInvoicePaymentFailed(invoice) {
  const businessId = await resolveBusinessFromStripeInvoice(invoice);
  if (!businessId) {
    console.warn('[stripe webhook] invoice.payment_failed: business not found');
    return null;
  }
  return startPaymentGracePeriod(businessId, { invoice });
}

/** Stripe webhook: invoice.payment_succeeded — receipt email + clear grace if healthy */
export async function handleInvoicePaymentSucceeded(invoice) {
  const businessId = await resolveBusinessFromStripeInvoice(invoice);
  if (!businessId) return null;

  const sub = await Subscription.findOne({ business: businessId });
  const wasPastDue = sub?.status === 'past_due' || Boolean(sub?.gracePeriodEnd);
  const amountPaid = Number(invoice?.amount_paid) || 0;
  const shouldReceipt =
    amountPaid > 0 ||
    invoice?.billing_reason === 'subscription_create' ||
    invoice?.billing_reason === 'subscription_cycle' ||
    invoice?.billing_reason === 'subscription_update';

  let recovered = false;
  if (wasPastDue && sub?.stripeSubscriptionId && isStripeConfigured()) {
    const stripeSub = await retrieveSubscription(sub.stripeSubscriptionId);
    if (stripeSub && ['active', 'trialing'].includes(stripeSub.status)) {
      await clearPaymentGracePeriod(businessId);
      recovered = true;
    }
  } else if (wasPastDue && !sub?.stripeSubscriptionId) {
    await clearPaymentGracePeriod(businessId);
    recovered = true;
  }

  if (shouldReceipt) {
    const fresh = await Subscription.findOne({ business: businessId });
    notifyPaymentReceipt(businessId, {
      planId: fresh?.plan || sub?.plan,
      invoice,
      recoveredFromPastDue: recovered
    }).catch((err) => console.error('[billing-email] receipt notify:', err.message));
  }

  return Subscription.findOne({ business: businessId });
}

export async function ensureBusinessSubscription(businessId) {
  let sub = await Subscription.findOne({ business: businessId });
  if (!sub) {
    sub = await Subscription.create({ business: businessId, plan: 'free', status: 'active' });
  } else if (sub.currentPeriodEnd && Number.isNaN(new Date(sub.currentPeriodEnd).getTime())) {
    sub.currentPeriodEnd = null;
    await sub.save();
  }
  return sub;
}

export async function getBusinessSubscription(businessId) {
  await enforceGracePeriodExpiry(businessId);
  const sub = await ensureBusinessSubscription(businessId);
  const planId = effectivePlanId(sub);
  return { subscription: sub, planId };
}

export async function getCurrentPlanPayload(businessId) {
  const { subscription, planId } = await getBusinessSubscription(businessId);
  return formatPlanForClient(planId, subscription);
}

export function listPublicPlans() {
  return publicPlansPayload();
}

/**
 * Pull latest subscription state from Stripe (works without webhooks — e.g. local dev).
 * Never invents a paid plan for an unlinked Free account from email-only Stripe matches.
 */
export async function syncSubscriptionFromStripe(businessId, userEmail) {
  if (!isStripeConfigured()) {
    throw new ApiError(503, 'Stripe is not configured');
  }

  const stripe = getStripe();
  const local = await ensureBusinessSubscription(businessId);
  const candidates = await collectStripeSubscriptionCandidates(stripe, {
    local,
    businessId,
    userEmail,
    purpose: 'sync'
  });

  if (!candidates.length) {
    // Free / unlinked: stay Free — do not error into an accidental upgrade path.
    if ((local.plan || 'free') === 'free' && !local.stripeSubscriptionId) {
      const data = await getCurrentPlanPayload(businessId);
      return {
        data,
        message: 'No Stripe subscription linked — still on Free plan.',
        stripeStatus: null
      };
    }
    throw new ApiError(
      404,
      'No Stripe subscription found for this business. Open Manage billing to link your account, or complete checkout again.'
    );
  }

  const best = candidates[0];

  // Extra guard: never attach a paid Stripe sub to Free unless it belongs to this business.
  const metaBusiness = best.stripeSub?.metadata?.businessId;
  const linkedSub =
    local.stripeSubscriptionId && String(local.stripeSubscriptionId) === String(best.stripeSub.id);
  const linkedCustomer =
    local.stripeCustomerId &&
    best.customerId &&
    String(local.stripeCustomerId) === String(best.customerId);
  const metaMatches = metaBusiness && String(metaBusiness) === String(businessId);

  if ((local.plan || 'free') === 'free' && !linkedSub && !metaMatches && !linkedCustomer) {
    const data = await getCurrentPlanPayload(businessId);
    return {
      data,
      message: 'No Stripe subscription linked to this business — still on Free plan.',
      stripeStatus: null
    };
  }

  async function applyFromStripeSub(stripeSub, customerId) {
    const payload = payloadFromStripeSubscription(stripeSub, { businessId });
    if (!payload.planId) {
      throw new ApiError(
        502,
        'Could not determine the plan from Stripe. Check STRIPE_PRICE_* env vars or complete checkout again.'
      );
    }

    await applySubscriptionFromStripe({
      ...payload,
      syncMode: true
    });

    const subDoc = await Subscription.findOne({ business: businessId });
    if (subDoc) {
      if (customerId) subDoc.stripeCustomerId = customerId;
      subDoc.stripeSubscriptionId = stripeSub.id;
      await subDoc.save();
    }

    if (stripeSub.status === 'past_due') {
      await startPaymentGracePeriod(businessId);
    } else if (['active', 'trialing'].includes(stripeSub.status)) {
      await clearPaymentGracePeriod(businessId);
    }
    await enforceGracePeriodExpiry(businessId);
    const data = await getCurrentPlanPayload(businessId);
    const message =
      stripeSub.status === 'past_due'
        ? 'Payment failed — grace period started. Update your payment method.'
        : `Synced to ${data.name}`;
    return { data, message, stripeStatus: stripeSub.status };
  }

  return applyFromStripeSub(best.stripeSub, best.customerId);
}

function stripeSubStatusRank(status, stripeSub) {
  const periodEnd = stripeSub?.current_period_end;
  const stillInPaidPeriod = periodEnd && periodEnd * 1000 > Date.now();
  if (status === 'canceled' && stillInPaidPeriod) return 1;
  if (status === 'past_due') return 0;
  if (['active', 'trialing'].includes(status)) return 1;
  return 2;
}

/**
 * Collect Stripe subscriptions that belong to this business.
 * @param {'sync'|'change'} purpose
 *   - sync: only already-linked IDs or metadata.businessId matches (never email-only)
 *   - change: also scan email customers, but still require metadata match or linked customer
 */
async function collectStripeSubscriptionCandidates(
  stripe,
  { local, businessId, userEmail, purpose = 'change' }
) {
  void purpose; // call sites pass 'sync' | 'change' for clarity / future policy splits
  const byId = new Map();

  const add = (stripeSub, customerId, { trusted = false } = {}) => {
    if (!stripeSub?.id) return;
    if (trusted) {
      byId.set(stripeSub.id, { stripeSub, customerId: customerId || null });
      return;
    }

    const metaBusiness = stripeSub.metadata?.businessId;
    const customerLinked =
      customerId &&
      local?.stripeCustomerId &&
      String(customerId) === String(local.stripeCustomerId);

    // Require an explicit business link — never adopt a stranger's subscription by email alone.
    if (metaBusiness) {
      if (String(metaBusiness) !== String(businessId)) return;
      byId.set(stripeSub.id, { stripeSub, customerId: customerId || null });
      return;
    }

    if (customerLinked) {
      byId.set(stripeSub.id, { stripeSub, customerId: customerId || null });
    }
  };

  if (local?.stripeSubscriptionId) {
    const stripeSub = await retrieveSubscription(local.stripeSubscriptionId);
    if (stripeSub) add(stripeSub, local.stripeCustomerId, { trusted: true });
  }

  const customerIds = new Set();
  if (local?.stripeCustomerId) customerIds.add(local.stripeCustomerId);

  // Email discovery finds prior Checkout customers. `add()` still requires metadata.businessId
  // or an already-linked Stripe customer — so sync cannot adopt a stranger's paid plan by email alone.
  if (userEmail) {
    try {
      const customers = await stripe.customers.list({ email: userEmail, limit: 20 });
      for (const customer of customers.data) customerIds.add(customer.id);
    } catch (err) {
      console.warn('[stripe sync] customer email lookup failed:', err.message);
    }
  }

  for (const customerId of customerIds) {
    try {
      const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 20 });
      for (const stripeSub of subs.data) add(stripeSub, customerId);
    } catch (err) {
      console.warn('[stripe sync] subscription list failed:', err.message);
    }
  }

  return [...byId.values()].sort((a, b) => {
    const statusDiff =
      stripeSubStatusRank(a.stripeSub.status, a.stripeSub) -
      stripeSubStatusRank(b.stripeSub.status, b.stripeSub);
    if (statusDiff !== 0) return statusDiff;

    const planDiff =
      (PLAN_RANK[planFromStripeSubscription(b.stripeSub)] ?? 0) -
      (PLAN_RANK[planFromStripeSubscription(a.stripeSub)] ?? 0);
    if (planDiff !== 0) return planDiff;

    return (b.stripeSub.created || 0) - (a.stripeSub.created || 0);
  });
}

export async function countInventoryItems(businessId) {
  if (!businessId) return 0;
  return Item.countDocuments(inventoryItemLimitQuery(businessId));
}

export async function countWarehouses(businessId) {
  return Warehouse.countDocuments({ business: businessId });
}

export async function countShipmentsThisYear(businessId) {
  const year = new Date().getFullYear();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);
  return Shipment.countDocuments({
    business: businessId,
    createdAt: { $gte: yearStart, $lt: yearEnd }
  });
}

export async function countStores(businessId) {
  return Store.countDocuments({ business: businessId });
}

export async function countBusinessUsers(businessId) {
  const business = await Business.findById(businessId).lean();
  const members = business?.members?.length || 0;
  const pendingInvites = await StaffInvitation.countDocuments({
    business: businessId,
    status: 'pending',
    expiresAt: { $gt: new Date() }
  });
  return members + pendingInvites;
}

export async function assertPlanFeature(businessId, featureKey) {
  const { planId } = await getBusinessSubscription(businessId);
  if (!planHasFeature(planId, featureKey)) {
    const label = featureKey === 'purchases' ? 'Purchases & Sourcing'
      : featureKey === 'shipping' ? 'Shipping Management'
        : featureKey === 'pos' ? 'POS / Stores & Sales'
          : featureKey === 'purchaseAiFill' ? 'AI Assistants (Purchase & Expense)'
            : featureKey;
    throw new ApiError(
      403,
      `${label} is not included on your ${getPlan(planId).name} plan. Upgrade to Professional or higher.`
    );
  }
}

/** UTC YYYY-MM key for AI Purchase Assistant monthly quota. */
export function currentAiMonthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function getAiAnalysesThisMonth(businessId) {
  const subscription = await ensureBusinessSubscription(businessId);
  const monthKey = currentAiMonthKey();
  if (subscription.aiAnalysesMonthKey !== monthKey) return 0;
  return Number(subscription.aiAnalysesCount) || 0;
}

/** Block when monthly AI analysis quota is exhausted (does not consume a use). */
export async function assertAiAnalysisAvailable(businessId) {
  await assertPlanFeature(businessId, 'purchaseAiFill');
  const { planId } = await getBusinessSubscription(businessId);
  const limit = getPlanLimit(planId, 'aiAnalysesPerMonth');
  if (limit === 0) {
    throw new ApiError(
      403,
      'AI Assistants are not included on your plan. Upgrade to Professional or higher.'
    );
  }
  if (limit === null) return { limit: null, used: await getAiAnalysesThisMonth(businessId) };

  const used = await getAiAnalysesThisMonth(businessId);
  if (used >= limit) {
    const upgradeHint =
      planId === 'professional'
        ? 'Upgrade to Professional Plus for 20,000 analyses/month.'
        : planId === 'professional_plus'
          ? 'Upgrade to Enterprise for unlimited AI.'
          : 'Upgrade your plan for a higher AI limit.';
    throw new ApiError(
      403,
      `You've used all ${limit.toLocaleString('en-US')} AI analyses this month. ${upgradeHint}`
    );
  }
  return { limit, used, remaining: limit - used };
}

/** Increment AI usage after a successful analysis. */
export async function recordAiAnalysisUse(businessId) {
  const subscription = await ensureBusinessSubscription(businessId);
  const monthKey = currentAiMonthKey();
  if (subscription.aiAnalysesMonthKey !== monthKey) {
    subscription.aiAnalysesMonthKey = monthKey;
    subscription.aiAnalysesCount = 0;
  }
  subscription.aiAnalysesCount = (Number(subscription.aiAnalysesCount) || 0) + 1;
  await subscription.save();
  return {
    used: subscription.aiAnalysesCount,
    monthKey
  };
}

export async function assertWithinLimit(businessId, limitKey, getCurrentCount) {
  if (!businessId) {
    throw new ApiError(400, 'Business context required to check plan limits');
  }
  const { planId } = await getBusinessSubscription(businessId);
  const limit = getPlanLimit(planId, limitKey);
  if (limit === null) return;
  const current = typeof getCurrentCount === 'function' ? await getCurrentCount() : getCurrentCount;
  if (current >= limit) {
    const plan = getPlan(planId);
    const label =
      limitKey === 'inventoryItems' ? 'inventory items'
        : limitKey === 'warehouses' ? 'warehouses'
          : limitKey === 'users' ? 'users'
            : limitKey === 'shipmentsPerYear' ? 'shipments per year'
              : limitKey === 'stores' ? 'stores'
                : limitKey === 'aiAnalysesPerMonth' ? 'AI analyses per month'
                  : limitKey;
    throw new ApiError(403, overLimitCreateMessage(plan.name, limit, label));
  }
}

function pendingPlanEffectiveAtMs(sub) {
  const raw = sub?.pendingPlanEffectiveAt || sub?.currentPeriodEnd;
  if (!raw) return 0;
  const ms = new Date(raw).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function isPendingDowngradeActive(sub) {
  if (!sub?.pendingPlan) return false;
  const effectiveAt = pendingPlanEffectiveAtMs(sub);
  return effectiveAt > Date.now();
}

function clearPendingPlanChange(sub) {
  sub.pendingPlan = null;
  sub.pendingPlanEffectiveAt = null;
  sub.cancelAtPeriodEnd = false;
}

function applySyncModePlan(sub, stripePlanId, cancelAtPeriodEnd, incomingPeriodEnd) {
  if (!stripePlanId || !PLAN_IDS.includes(stripePlanId)) return;

  const currentPlan = sub.plan || 'free';
  const stripeRank = PLAN_RANK[stripePlanId] ?? 0;
  const currentRank = PLAN_RANK[currentPlan] ?? 0;

  if (stripeRank > currentRank) {
    sub.plan = stripePlanId;
    clearPendingPlanChange(sub);
    return;
  }

  if (sub.pendingPlan && !sub.pendingPlanEffectiveAt && incomingPeriodEnd) {
    sub.pendingPlanEffectiveAt = incomingPeriodEnd;
  }

  if (isPendingDowngradeActive(sub)) {
    return;
  }

  if (sub.pendingPlan) {
    sub.plan = sub.pendingPlan;
    clearPendingPlanChange(sub);
    return;
  }

  sub.plan = stripePlanId;
  if (!cancelAtPeriodEnd) {
    clearPendingPlanChange(sub);
  }
}

export async function applySubscriptionFromStripe({
  businessId,
  planId,
  stripeCustomerId,
  stripeSubscriptionId,
  stripePriceId,
  status,
  billingInterval,
  currentPeriodEnd,
  cancelAtPeriodEnd = false,
  forcePlanUpdate = false,
  syncMode = false
}) {
  const sub = await ensureBusinessSubscription(businessId);
  const activating = status === 'active' || status === 'trialing';
  const incomingPeriodEnd = coerceValidDate(currentPeriodEnd);

  if (planId) {
    if (syncMode) {
      applySyncModePlan(sub, planId, cancelAtPeriodEnd, incomingPeriodEnd);
    } else if (forcePlanUpdate && activating) {
      sub.plan = planId;
      clearPendingPlanChange(sub);
    } else if (sub.pendingPlan) {
      if (planId === sub.pendingPlan && !isPendingDowngradeActive(sub)) {
        sub.plan = planId;
        clearPendingPlanChange(sub);
      } else if (activating && (PLAN_RANK[planId] ?? 0) > (PLAN_RANK[sub.pendingPlan] ?? 0)) {
        sub.plan = planId;
        clearPendingPlanChange(sub);
      }
    } else {
      sub.plan = planId;
    }
  }
  sub.status = status || sub.status;
  if (stripeCustomerId) sub.stripeCustomerId = stripeCustomerId;
  if (stripeSubscriptionId) sub.stripeSubscriptionId = stripeSubscriptionId;
  if (stripePriceId) sub.stripePriceId = stripePriceId;
  if (billingInterval) sub.billingInterval = billingInterval;
  sub.currentPeriodEnd = incomingPeriodEnd;
  sub.cancelAtPeriodEnd = cancelAtPeriodEnd;
  if (cancelAtPeriodEnd && !sub.pendingPlan) {
    sub.pendingPlan = 'free';
    if (!sub.pendingPlanEffectiveAt && incomingPeriodEnd) {
      sub.pendingPlanEffectiveAt = incomingPeriodEnd;
    }
  }
  if (status === 'active' || status === 'trialing') {
    sub.gracePeriodEnd = null;
  }
  await sub.save();
  if (status === 'active' || status === 'trialing') {
    await syncGracePeriodToUsers(businessId, null);
  }
  return sub;
}

export async function downgradeToFree(
  businessId,
  { notify = true, reason = 'applied', fromPlanId = null } = {}
) {
  const sub = await ensureBusinessSubscription(businessId);
  const previousPlan = fromPlanId || sub.plan;
  sub.plan = 'free';
  sub.status = 'active';
  sub.billingInterval = null;
  sub.stripeSubscriptionId = '';
  sub.stripePriceId = '';
  sub.currentPeriodEnd = null;
  clearPendingPlanChange(sub);
  sub.gracePeriodEnd = null;
  await sub.save();
  await syncGracePeriodToUsers(businessId, null);

  if (notify && previousPlan && previousPlan !== 'free') {
    notifyPlanDowngrade(businessId, {
      fromPlanId: previousPlan,
      toPlanId: 'free',
      immediate: true,
      reason
    }).catch((err) => console.error('[billing-email] downgrade notify:', err.message));
  }
  return sub;
}

/** Background job: downgrade businesses whose payment grace period has expired. */
export async function sweepExpiredGracePeriods() {
  const subs = await Subscription.find({
    status: 'past_due',
    gracePeriodEnd: { $lte: new Date() }
  }).select('business');
  for (const sub of subs) {
    await enforceGracePeriodExpiry(sub.business);
  }
}

function downgradeMessage(sub, targetPlanId, immediate) {
  const targetName = getPlan(targetPlanId).name;
  if (immediate) return `Switched to ${targetName} plan`;
  const end = sub.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC'
      })
    : 'the end of your billing period';
  return `You keep ${getPlan(sub.plan).name} access until ${end}. Your plan will change to ${targetName} after that.`;
}

/**
 * Schedule a downgrade at period end (Stripe cancel or price swap) or apply immediately when no Stripe sub.
 */
export async function schedulePlanDowngrade(businessId, targetPlanId) {
  if (!['free', 'professional', 'professional_plus', 'enterprise'].includes(targetPlanId)) {
    throw new ApiError(400, 'Invalid target plan');
  }

  const { subscription, planId: currentPlanId } = await getBusinessSubscription(businessId);

  if (targetPlanId === currentPlanId && !subscription.pendingPlan) {
    throw new ApiError(400, 'You are already on this plan');
  }
  if (!isPlanDowngrade(currentPlanId, targetPlanId)) {
    throw new ApiError(400, 'Target plan is not a downgrade from your current plan');
  }

  if (
    subscription.pendingPlan === targetPlanId &&
    (subscription.cancelAtPeriodEnd || subscription.pendingPlan !== 'free')
  ) {
    return { subscription, alreadyScheduled: true, immediate: false };
  }

  const stripeSubId = subscription.stripeSubscriptionId;
  const fromPlanId = currentPlanId;

  if (!stripeSubId) {
    if (targetPlanId === 'free') {
      await downgradeToFree(businessId, { fromPlanId, reason: 'user' });
    } else {
      subscription.plan = targetPlanId;
      clearPendingPlanChange(subscription);
      await subscription.save();
      notifyPlanDowngrade(businessId, {
        fromPlanId,
        toPlanId: targetPlanId,
        immediate: true,
        reason: 'user'
      }).catch((err) => console.error('[billing-email] downgrade notify:', err.message));
    }
    const updated = await ensureBusinessSubscription(businessId);
    return {
      subscription: updated,
      immediate: true,
      message: downgradeMessage(updated, targetPlanId, true)
    };
  }

  if (!isStripeConfigured()) {
    throw new ApiError(503, 'Stripe is not configured. Add STRIPE_SECRET_KEY to server/.env');
  }

  let stripeSub;
  if (targetPlanId === 'free') {
    stripeSub = await cancelSubscriptionAtPeriodEnd(stripeSubId);
    subscription.pendingPlan = 'free';
    subscription.cancelAtPeriodEnd = true;
  } else {
    stripeSub = await changeSubscriptionPlanAtPeriodEnd(
      stripeSubId,
      targetPlanId,
      subscription.billingInterval || 'month'
    );
    subscription.pendingPlan = targetPlanId;
    subscription.cancelAtPeriodEnd = false;
  }

  const periodEnd = periodEndFromStripeSubscription(stripeSub);
  subscription.pendingPlanEffectiveAt = periodEnd;
  subscription.currentPeriodEnd = periodEnd;
  await subscription.save();

  notifyPlanDowngrade(businessId, {
    fromPlanId,
    toPlanId: targetPlanId,
    immediate: false,
    effectiveAt: periodEnd,
    reason: 'user'
  }).catch((err) => console.error('[billing-email] downgrade notify:', err.message));

  return {
    subscription,
    immediate: false,
    message: downgradeMessage(subscription, targetPlanId, false)
  };
}

/**
 * Upgrade or switch to a paid plan without creating duplicate Stripe subscriptions.
 * - No active Stripe sub → Checkout Session
 * - Active / trialing Stripe sub → update subscription in place (prorated)
 * - past_due → Customer Portal (fix payment) instead of a second checkout
 */
export async function changeOrUpgradePlan(businessId, {
  planId,
  interval = 'month',
  userId,
  userEmail,
  returnUrl
} = {}) {
  if (!PLAN_IDS.includes(planId) || planId === 'free') {
    throw new ApiError(400, 'Invalid plan selected');
  }
  if (!['month', 'year'].includes(interval)) {
    throw new ApiError(400, 'Billing interval must be month or year');
  }
  if (!isStripeConfigured()) {
    throw new ApiError(503, 'Stripe is not configured. Add STRIPE_SECRET_KEY to server/.env');
  }

  await enforceGracePeriodExpiry(businessId);
  const local = await ensureBusinessSubscription(businessId);
  const stripe = getStripe();
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const portalReturn =
    returnUrl || `${String(clientUrl).replace(/\/$/, '')}/pricing?portal=return`;

  const candidates = await collectStripeSubscriptionCandidates(stripe, {
    local,
    businessId,
    userEmail,
    purpose: 'change'
  });

  const usable = candidates.filter(({ stripeSub }) =>
    ['active', 'trialing', 'past_due', 'unpaid', 'incomplete'].includes(stripeSub.status)
  );
  const best = usable[0] || null;

  if (best) {
    const { canceled } = await cancelDuplicateStripeSubscriptions(best.stripeSub.id, usable);
    if (canceled.length) {
      console.log(
        `[subscriptions] business ${businessId}: removed ${canceled.length} duplicate Stripe subscription(s)`
      );
    }

    const customerId =
      best.customerId ||
      (typeof best.stripeSub.customer === 'string'
        ? best.stripeSub.customer
        : best.stripeSub.customer?.id) ||
      local.stripeCustomerId;

    if (customerId && local.stripeCustomerId !== customerId) {
      local.stripeCustomerId = customerId;
    }
    if (local.stripeSubscriptionId !== best.stripeSub.id) {
      local.stripeSubscriptionId = best.stripeSub.id;
    }
    await local.save();

    // past_due / unpaid: send to portal to update card — do not open a second Checkout
    if (['past_due', 'unpaid'].includes(best.stripeSub.status) || local.status === 'past_due') {
      if (!customerId) {
        throw new ApiError(
          400,
          'Payment is past due but no Stripe customer is linked. Contact support or sync billing first.'
        );
      }
      const portal = await createPortalSession({ customerId, returnUrl: portalReturn });
      console.log(
        `[subscriptions] business ${businessId}: past_due → portal (refusing new checkout)`
      );
      return {
        mode: 'portal',
        url: portal.url,
        message:
          'Your payment failed. Update your payment method in the billing portal, then try upgrading again.'
      };
    }

    // Abandoned incomplete checkouts — cancel so a fresh Checkout can be created
    if (best.stripeSub.status === 'incomplete') {
      try {
        await cancelSubscriptionImmediately(best.stripeSub.id);
        console.log(
          `[subscriptions] business ${businessId}: canceled incomplete sub ${best.stripeSub.id}`
        );
      } catch (err) {
        console.warn('[subscriptions] could not cancel incomplete sub:', err.message);
      }
      // Fall through to new Checkout below
    } else if (['active', 'trialing'].includes(best.stripeSub.status)) {
      // Active paid subscription → update in place (never create another Checkout)
      const currentStripePlan = planFromStripeSubscription(best.stripeSub) || local.plan;
      const currentInterval =
        billingIntervalFromStripeSubscription(best.stripeSub) || local.billingInterval || 'month';
      const samePlan = currentStripePlan === planId && currentInterval === interval;

      if (samePlan && !best.stripeSub.cancel_at_period_end && !local.pendingPlan) {
        throw new ApiError(400, `You are already on the ${getPlan(planId).name} plan`);
      }

      if (isPlanDowngrade(currentStripePlan, planId)) {
        throw new ApiError(
          400,
          'Use Downgrade to switch to a lower plan. Upgrades are handled here.'
        );
      }

      try {
        const updatedStripeSub = await changeSubscriptionPlanNow(
          best.stripeSub.id,
          planId,
          interval,
          { businessId }
        );

        await applySubscriptionFromStripe({
          ...payloadFromStripeSubscription(updatedStripeSub, { businessId, planId }),
          forcePlanUpdate: true
        });

        // Ensure pending cancel / scheduled downgrade is cleared locally
        const refreshed = await ensureBusinessSubscription(businessId);
        clearPendingPlanChange(refreshed);
        refreshed.cancelAtPeriodEnd = false;
        refreshed.plan = planId;
        refreshed.billingInterval = interval;
        refreshed.status = mapStripeStatus(updatedStripeSub.status) || 'active';
        await refreshed.save();

        const data = await getCurrentPlanPayload(businessId);
        console.log(
          `[subscriptions] business ${businessId}: upgraded in-place to ${planId}/${interval}`
        );
        return {
          mode: 'updated',
          data,
          message: `Upgraded to ${data.name}. Proration may appear on your next invoice.`
        };
      } catch (err) {
        console.error('[subscriptions] in-place upgrade failed:', err.message);
        // Fallback: portal plan switch (still no second subscription)
        if (customerId) {
          const portal = await createPortalSession({ customerId, returnUrl: portalReturn });
          return {
            mode: 'portal',
            url: portal.url,
            message:
              err.message ||
              'Could not update the plan automatically. Continue in the Stripe billing portal.'
          };
        }
        throw new ApiError(502, err.message || 'Could not update subscription');
      }
    }
  }

  // No usable Stripe subscription → first paid purchase via Checkout
  let customerId = local.stripeCustomerId || undefined;
  if (!customerId) {
    customerId = (await resolveStripeCustomerId(businessId, userEmail)) || undefined;
  }

  // Free trial only on first paid Checkout (never on upgrades / returning customers)
  let trialPeriodDays = 0;
  const configuredTrial = getStripeTrialPeriodDays();
  if (configuredTrial > 0) {
    const alreadyPaidLocally =
      Boolean(local.stripeSubscriptionId) ||
      (local.plan && local.plan !== 'free') ||
      ['trialing', 'past_due', 'canceled', 'unpaid'].includes(local.status);
    const alreadyPaidOnStripe = customerId
      ? await customerHasUsedPaidSubscription(customerId)
      : false;
    if (!alreadyPaidLocally && !alreadyPaidOnStripe) {
      trialPeriodDays = configuredTrial;
    } else {
      console.log(
        `[subscriptions] business ${businessId}: trial skipped (prior subscription history)`
      );
    }
  }

  console.log(
    `[subscriptions] business ${businessId}: no active Stripe sub → Checkout for ${planId}/${interval}` +
      (trialPeriodDays ? ` (${trialPeriodDays}-day trial)` : '')
  );
  const session = await createCheckoutSession({
    businessId,
    userId,
    userEmail,
    planId,
    interval,
    customerId,
    trialPeriodDays
  });

  return {
    mode: 'checkout',
    url: session.url,
    sessionId: session.id,
    trialPeriodDays,
    message: trialPeriodDays
      ? `Redirecting to Stripe Checkout — ${trialPeriodDays}-day free trial`
      : 'Redirecting to Stripe Checkout'
  };
}

/** When a scheduled paid downgrade renews, Stripe switches the price — apply pending plan locally. */
export async function applyPendingDowngradeIfDue(sub, stripeSub) {
  if (!sub?.pendingPlan || sub.pendingPlan === 'free') return sub;
  if (isPendingDowngradeActive(sub)) return sub;

  const interval = sub.billingInterval || billingIntervalFromStripeSubscription(stripeSub) || 'month';
  const targetPriceId = resolveStripePriceId(sub.pendingPlan, interval);
  const activePriceId = stripeSub?.items?.data?.[0]?.price?.id;
  const resolvedPlan = planFromStripeSubscription(stripeSub);

  const priceMatches = targetPriceId && activePriceId === targetPriceId;
  const planMatches = !targetPriceId && resolvedPlan === sub.pendingPlan;

  if (priceMatches || planMatches) {
    await applySubscriptionFromStripe({
      ...payloadFromStripeSubscription(stripeSub, {
        businessId: sub.business,
        planId: sub.pendingPlan
      })
    });
    clearPendingPlanChange(sub);
    await sub.save();
  }

  return sub;
}

export function mapStripeStatus(stripeStatus) {
  const map = {
    active: 'active',
    trialing: 'trialing',
    past_due: 'past_due',
    canceled: 'canceled',
    unpaid: 'unpaid',
    incomplete: 'incomplete',
    incomplete_expired: 'canceled'
  };
  return map[stripeStatus] || 'active';
}

/** Normalize Stripe timestamps (Unix seconds) or Date values; null if invalid. */
export function coerceValidDate(value) {
  if (value == null || value === '') return null;

  let date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'number' && Number.isFinite(value)) {
    date = value > 1e12 ? new Date(value) : new Date(value * 1000);
  } else if (typeof value === 'string') {
    const asNum = Number(value);
    if (Number.isFinite(asNum) && asNum > 0) {
      date = asNum > 1e12 ? new Date(asNum) : new Date(asNum * 1000);
    } else {
      date = new Date(value);
    }
  } else {
    return null;
  }

  return date && !Number.isNaN(date.getTime()) ? date : null;
}

/** @deprecated use coerceValidDate */
export function parseStripeUnixDate(unixSeconds) {
  return coerceValidDate(unixSeconds);
}

export function periodEndFromStripeSubscription(stripeSub) {
  if (!stripeSub) return null;
  const candidates = [
    stripeSub.current_period_end,
    stripeSub.currentPeriodEnd,
    stripeSub.items?.data?.[0]?.current_period_end
  ];
  for (const candidate of candidates) {
    const date = coerceValidDate(candidate);
    if (date) return date;
  }
  return null;
}

export function billingIntervalFromStripeSubscription(stripeSub) {
  const interval = stripeSub?.items?.data?.[0]?.plan?.interval || stripeSub?.items?.data?.[0]?.price?.recurring?.interval;
  return interval === 'year' ? 'year' : 'month';
}

export function payloadFromStripeSubscription(stripeSub, { businessId, planId } = {}) {
  const priceId = stripeSub?.items?.data?.[0]?.price?.id || '';
  return {
    businessId,
    planId: planId || planFromStripeSubscription(stripeSub),
    stripeCustomerId: typeof stripeSub.customer === 'string' ? stripeSub.customer : stripeSub.customer?.id,
    stripeSubscriptionId: stripeSub.id,
    stripePriceId: priceId || undefined,
    status: mapStripeStatus(stripeSub.status),
    billingInterval: billingIntervalFromStripeSubscription(stripeSub),
    currentPeriodEnd: periodEndFromStripeSubscription(stripeSub),
    cancelAtPeriodEnd: Boolean(stripeSub.cancel_at_period_end)
  };
}

function productNameFromStripeItem(item) {
  const price = item?.price;
  const legacyPlan = item?.plan;
  const product = price?.product;
  if (product && typeof product === 'object' && product.name) return product.name;
  if (legacyPlan?.product && typeof legacyPlan.product === 'object' && legacyPlan.product.name) {
    return legacyPlan.product.name;
  }
  return price?.nickname || legacyPlan?.nickname || '';
}

/** Resolve plan from Stripe price/product — metadata alone is often stale after portal upgrades. */
export function planFromStripeSubscription(stripeSub) {
  const item = stripeSub?.items?.data?.[0];
  const price = item?.price;
  const priceId = price?.id;

  const fromMeta = planFromMetadata(stripeSub?.metadata);
  const fromPriceId = planIdFromStripePriceId(priceId);

  let fromName = null;
  const name = productNameFromStripeItem(item).toLowerCase();
  if (name.includes('enterprise')) fromName = 'enterprise';
  else if (name.includes('professional plus') || name.includes('professional_plus')) {
    fromName = 'professional_plus';
  } else if (name.includes('professional')) fromName = 'professional';

  let fromAmount = null;
  if (price?.unit_amount != null) {
    const amount = price.unit_amount;
    const interval = price.recurring?.interval || 'month';
    const enterpriseMonthly = Math.round(getPlan('enterprise').priceMonthly * 100);
    const professionalPlusMonthly = Math.round(getPlan('professional_plus').priceMonthly * 100);
    const professionalMonthly = Math.round(getPlan('professional').priceMonthly * 100);
    const enterpriseYearly = Math.round(getPlan('enterprise').priceYearly * 100);
    const professionalPlusYearly = Math.round(getPlan('professional_plus').priceYearly * 100);
    const professionalYearly = Math.round(getPlan('professional').priceYearly * 100);

    if (interval === 'year') {
      if (amount === enterpriseYearly) fromAmount = 'enterprise';
      else if (amount === professionalPlusYearly) fromAmount = 'professional_plus';
      else if (amount === professionalYearly) fromAmount = 'professional';
    } else {
      if (amount === enterpriseMonthly) fromAmount = 'enterprise';
      else if (amount === professionalPlusMonthly) fromAmount = 'professional_plus';
      else if (amount === professionalMonthly) fromAmount = 'professional';
    }
  }

  const candidates = [fromPriceId, fromName, fromAmount, fromMeta].filter(Boolean);
  // Unknown Stripe prices must not silently become Professional (that caused free→paid sync bugs).
  if (!candidates.length) return null;

  return candidates.sort((a, b) => (PLAN_RANK[b] ?? 0) - (PLAN_RANK[a] ?? 0))[0];
}

export function planFromMetadata(metadata = {}) {
  const planId = metadata.planId || metadata.plan;
  if (planId && getPlan(planId)) return planId;
  return null;
}

/** Apply plan from a completed Stripe Checkout session (webhook + success redirect). */
export async function syncFromCheckoutSession(session) {
  const businessId = session.metadata?.businessId || session.client_reference_id;
  if (!businessId) {
    throw new ApiError(400, 'Checkout session is missing business metadata');
  }

  const planId = planFromMetadata(session.metadata);
  const interval = session.metadata?.interval === 'year' ? 'year' : 'month';
  let status = 'active';
  let currentPeriodEnd = null;
  let resolvedPlanId = planId;

  const stripeSubId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;

  let stripeSub = null;
  if (stripeSubId) {
    stripeSub = await retrieveSubscription(stripeSubId);
    if (stripeSub) {
      status = mapStripeStatus(stripeSub.status);
      currentPeriodEnd = periodEndFromStripeSubscription(stripeSub);
      resolvedPlanId =
        planFromStripeSubscription(stripeSub) || planFromMetadata(stripeSub.metadata) || planId;
    }
  }

  if (!resolvedPlanId || !PLAN_IDS.includes(resolvedPlanId) || resolvedPlanId === 'free') {
    throw new ApiError(
      502,
      'Checkout completed but the paid plan could not be determined. Contact support with your Stripe session id.'
    );
  }

  return applySubscriptionFromStripe({
    businessId,
    planId: resolvedPlanId,
    stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
    stripeSubscriptionId: stripeSubId,
    status,
    billingInterval: interval,
    currentPeriodEnd,
    forcePlanUpdate: true
  });
}
