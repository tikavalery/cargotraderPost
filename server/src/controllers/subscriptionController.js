import ApiError, { asyncHandler } from '../utils/ApiError.js';
import { PLAN_IDS } from '../constants/plans.js';
import {
  applySubscriptionFromStripe,
  changeOrUpgradePlan,
  countBusinessUsers,
  countInventoryItems,
  countShipmentsThisYear,
  countStores,
  countWarehouses,
  getAiAnalysesThisMonth,
  downgradeToFree,
  getBusinessSubscription,
  getCurrentPlanPayload,
  listPublicPlans,
  schedulePlanDowngrade,
  applyPendingDowngradeIfDue,
  syncFromCheckoutSession,
  payloadFromStripeSubscription,
  syncSubscriptionFromStripe,
  handleInvoicePaymentFailed,
  handleInvoicePaymentSucceeded,
  startPaymentGracePeriod,
  clearPaymentGracePeriod,
  enforceGracePeriodExpiry
} from '../services/subscriptionService.js';
import { getPlanLimit, isPlanDowngrade } from '../constants/plans.js';
import {
  evaluateLimit,
  PLAN_LIMIT_POLICY,
  PLAN_LIMIT_POLICY_SUMMARY
} from '../constants/planLimitPolicy.js';
import {
  cancelDuplicateStripeSubscriptions,
  constructWebhookEvent,
  getStripe,
  isStripeConfigured,
  retrieveCheckoutSession,
  createPortalSession,
  resolveStripeCustomerId
} from '../services/stripeService.js';
import Subscription from '../models/Subscription.js';
import StripeWebhookEvent from '../models/StripeWebhookEvent.js';

function isStripePriceOrPlanError(err) {
  const message = err?.message || err?.raw?.message || '';
  if (typeof message !== 'string') return false;
  return (
    message.includes('Stripe price for') ||
    message.includes('No such price') ||
    message.includes('not configured') ||
    message.includes('unknown parameter')
  );
}

async function portalFallbackForDowngrade(req, res) {
  const customerId = await resolveStripeCustomerId(req.businessId, req.userDoc?.email);
  if (!customerId) return null;

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const returnUrl = req.body?.returnUrl || `${clientUrl.replace(/\/$/, '')}/pricing?portal=return`;
  const portal = await createPortalSession({ customerId, returnUrl });
  return res.json({
    ok: true,
    requiresPortal: true,
    url: portal.url,
    message:
      'Continue in Stripe Billing Portal to change your plan, then return here to refresh.'
  });
}

export const listPlans = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.json({
    ok: true,
    plansBuild: '2026-07-inventory-limits',
    plans: listPublicPlans()
  });
});

export const getCurrent = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const data = await getCurrentPlanPayload(req.businessId);
  res.json({ ok: true, data });
});

export const getUsage = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const { planId } = await getBusinessSubscription(req.businessId);
  const limits = {
    inventoryItems: getPlanLimit(planId, 'inventoryItems'),
    warehouses: getPlanLimit(planId, 'warehouses'),
    users: getPlanLimit(planId, 'users'),
    shipmentsPerYear: getPlanLimit(planId, 'shipmentsPerYear'),
    stores: getPlanLimit(planId, 'stores'),
    aiAnalysesPerMonth: getPlanLimit(planId, 'aiAnalysesPerMonth')
  };
  const usage = {
    inventoryItems: await countInventoryItems(req.businessId),
    warehouses: await countWarehouses(req.businessId),
    users: await countBusinessUsers(req.businessId),
    shipmentsThisYear: await countShipmentsThisYear(req.businessId),
    stores: await countStores(req.businessId),
    aiAnalysesThisMonth: await getAiAnalysesThisMonth(req.businessId)
  };
  const status = {
    inventoryItems: evaluateLimit(limits.inventoryItems, usage.inventoryItems),
    warehouses: evaluateLimit(limits.warehouses, usage.warehouses),
    users: evaluateLimit(limits.users, usage.users),
    shipmentsPerYear: evaluateLimit(limits.shipmentsPerYear, usage.shipmentsThisYear),
    stores: evaluateLimit(limits.stores, usage.stores),
    aiAnalysesPerMonth: evaluateLimit(limits.aiAnalysesPerMonth, usage.aiAnalysesThisMonth)
  };
  const overLimitKeys = Object.entries(status)
    .filter(([, s]) => s.overLimit)
    .map(([key]) => key);

  res.json({
    ok: true,
    planId,
    limits,
    usage,
    status,
    overLimitKeys,
    policy: PLAN_LIMIT_POLICY,
    policySummary: PLAN_LIMIT_POLICY_SUMMARY
  });
});

/**
 * Start paid plan flow: Checkout (first time), in-place Stripe update (upgrade),
 * or Customer Portal (past_due). Never opens a second Checkout when a sub exists.
 */
export const createCheckoutSessionHandler = asyncHandler(async (req, res) => {
  const { planId, interval = 'month', returnUrl } = req.body;

  try {
    const result = await changeOrUpgradePlan(req.businessId, {
      planId,
      interval,
      userId: req.userDoc._id,
      userEmail: req.userDoc.email,
      returnUrl
    });

    res.json({
      ok: true,
      mode: result.mode,
      url: result.url,
      sessionId: result.sessionId,
      data: result.data,
      trialPeriodDays: result.trialPeriodDays || 0,
      message: result.message
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error('[subscriptions/create-checkout-session]', err);
    throw new ApiError(502, err.message || 'Could not start plan change');
  }
});

/** Upgrade or downgrade from one endpoint — routes to the correct flow. */
export const changePlanHandler = asyncHandler(async (req, res) => {
  const { planId, interval = 'month', returnUrl } = req.body;
  if (!planId || !PLAN_IDS.includes(planId)) {
    throw new ApiError(400, 'planId is required');
  }

  const { planId: currentId } = await getBusinessSubscription(req.businessId);
  if (planId === currentId) {
    throw new ApiError(400, 'You are already on this plan');
  }

  if (planId === 'free' || isPlanDowngrade(currentId, planId)) {
    try {
      const result = await schedulePlanDowngrade(req.businessId, planId);
      const data = await getCurrentPlanPayload(req.businessId);
      return res.json({
        ok: true,
        data,
        scheduled: !result.immediate,
        alreadyScheduled: Boolean(result.alreadyScheduled),
        message:
          result.message ||
          (result.alreadyScheduled
            ? 'This downgrade is already scheduled'
            : result.immediate
              ? `Switched to ${data.pendingPlanName || data.name}`
              : 'Downgrade scheduled')
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (isStripePriceOrPlanError(err)) {
        const portalRes = await portalFallbackForDowngrade(req, res);
        if (portalRes) return portalRes;
      }
      throw new ApiError(502, err.message || 'Could not schedule downgrade with Stripe');
    }
  }

  try {
    const result = await changeOrUpgradePlan(req.businessId, {
      planId,
      interval,
      userId: req.userDoc._id,
      userEmail: req.userDoc.email,
      returnUrl
    });
    return res.json({
      ok: true,
      mode: result.mode,
      url: result.url,
      sessionId: result.sessionId,
      data: result.data,
      trialPeriodDays: result.trialPeriodDays || 0,
      message: result.message
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error('[subscriptions/change-plan]', err);
    throw new ApiError(502, err.message || 'Could not change plan');
  }
});

/** After Stripe redirect — sync plan even if webhook has not fired yet. */
export const confirmCheckoutSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) throw new ApiError(400, 'sessionId is required');
  if (!isStripeConfigured()) {
    throw new ApiError(503, 'Stripe is not configured');
  }

  let session = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    session = await retrieveCheckoutSession(sessionId);
    if (!session) throw new ApiError(404, 'Checkout session not found');

    const subscriptionId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    const ready =
      session.payment_status === 'paid' ||
      session.status === 'complete' ||
      Boolean(subscriptionId);

    if (ready) break;
    if (attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
    }
  }

  const businessId = session.metadata?.businessId || session.client_reference_id;
  if (!businessId || String(businessId) !== String(req.businessId)) {
    throw new ApiError(403, 'This checkout session does not belong to your business');
  }

  if (session.payment_status !== 'paid' && session.status !== 'complete') {
    throw new ApiError(400, 'Payment is not complete yet. Please wait a moment and refresh.');
  }

  await syncFromCheckoutSession(session);
  const data = await getCurrentPlanPayload(req.businessId);
  res.json({ ok: true, data, message: `Plan updated to ${data.name}` });
});

/** Find Stripe subscription and sync status (including past_due) — no webhook required. */
export const syncSubscription = asyncHandler(async (req, res) => {
  try {
    const result = await syncSubscriptionFromStripe(req.businessId, req.userDoc?.email);
    res.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error('[subscriptions/sync]', err);
    throw new ApiError(502, err.message || 'Stripe sync failed. Check server logs and STRIPE_SECRET_KEY.');
  }
});

export const selectFreePlan = asyncHandler(async (req, res) => {
  const targetPlanId = req.body?.planId && req.body.planId !== 'free' ? req.body.planId : 'free';

  if (targetPlanId !== 'free') {
    try {
      const result = await schedulePlanDowngrade(req.businessId, targetPlanId);
      const data = await getCurrentPlanPayload(req.businessId);
      return res.json({
        ok: true,
        data,
        scheduled: !result.immediate,
        alreadyScheduled: Boolean(result.alreadyScheduled),
        message:
          result.message ||
          (result.alreadyScheduled
            ? 'This downgrade is already scheduled'
            : result.immediate
              ? `Switched to ${data.name}`
              : 'Downgrade scheduled')
      });
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (isStripePriceOrPlanError(err)) {
        const portalRes = await portalFallbackForDowngrade(req, res);
        if (portalRes) return portalRes;
      }
      throw new ApiError(502, err.message || 'Could not schedule downgrade with Stripe');
    }
  }

  const result = await schedulePlanDowngrade(req.businessId, 'free');
  const data = await getCurrentPlanPayload(req.businessId);
  res.json({
    ok: true,
    data,
    scheduled: !result.immediate,
    message: result.message || (result.immediate ? 'Switched to Free plan' : 'Downgrade to Free scheduled')
  });
});

/** Schedule downgrade at end of billing period (Stripe cancel_at_period_end or price swap). */
export const downgradePlan = asyncHandler(async (req, res) => {
  const { planId } = req.body;
  if (!planId) throw new ApiError(400, 'planId is required');

  try {
    const result = await schedulePlanDowngrade(req.businessId, planId);
    const data = await getCurrentPlanPayload(req.businessId);
    res.json({
      ok: true,
      data,
      scheduled: !result.immediate,
      alreadyScheduled: Boolean(result.alreadyScheduled),
      message:
        result.message ||
        (result.alreadyScheduled
          ? 'This downgrade is already scheduled'
          : result.immediate
            ? `Switched to ${data.pendingPlanName || data.name}`
            : 'Downgrade scheduled')
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (isStripePriceOrPlanError(err)) {
      const portalRes = await portalFallbackForDowngrade(req, res);
      if (portalRes) return portalRes;
    }
    throw new ApiError(502, err.message || 'Could not schedule downgrade with Stripe');
  }
});

/** Stripe webhook — mounted with express.raw() in index.js */
export async function stripeWebhookHandler(req, res) {
  let event;
  try {
    const signature = req.headers['stripe-signature'];
    event = constructWebhookEvent(req.body, signature);
  } catch (err) {
    console.error('[stripe webhook] signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Idempotency: Stripe retries deliveries; skip events we already processed.
  const alreadyProcessed = await StripeWebhookEvent.exists({ eventId: event.id });
  if (alreadyProcessed) {
    return res.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      default:
        break;
    }

    try {
      await StripeWebhookEvent.create({
        eventId: event.id,
        type: event.type,
        processedAt: new Date()
      });
    } catch (err) {
      if (err?.code === 11000) {
        return res.json({ received: true, duplicate: true });
      }
      console.error('[stripe webhook] failed to persist event id:', err.message);
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[stripe webhook] handler error:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
}

async function handleCheckoutCompleted(session) {
  try {
    await syncFromCheckoutSession(session);

    // Defense: if an older Checkout somehow completed while another sub existed, cancel extras
    const businessId = session.metadata?.businessId || session.client_reference_id;
    const keptId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    if (businessId && keptId && isStripeConfigured()) {
      const local = await Subscription.findOne({ business: businessId });
      const stripe = getStripe();
      const customerId =
        typeof session.customer === 'string' ? session.customer : session.customer?.id;
      if (stripe && customerId) {
        const subs = await stripe.subscriptions.list({
          customer: customerId,
          status: 'all',
          limit: 20
        });
        const candidates = subs.data
          .filter((s) => {
            const meta = s.metadata?.businessId;
            return !meta || String(meta) === String(businessId);
          })
          .map((stripeSub) => ({ stripeSub }));
        await cancelDuplicateStripeSubscriptions(keptId, candidates);
        if (local && local.stripeSubscriptionId !== keptId) {
          local.stripeSubscriptionId = keptId;
          await local.save();
        }
      }
    }
  } catch (err) {
    console.error('[stripe webhook] checkout.session.completed:', err.message);
    throw err;
  }
}

async function handleSubscriptionUpdated(stripeSub) {
  const businessId = stripeSub.metadata?.businessId;
  let local = businessId
    ? await Subscription.findOne({ business: businessId })
    : await Subscription.findOne({ stripeSubscriptionId: stripeSub.id });

  if (!local && !businessId) return;

  const resolvedBusinessId = businessId || local?.business;
  if (!resolvedBusinessId) return;

  const payload = payloadFromStripeSubscription(stripeSub, {
    businessId: resolvedBusinessId
  });

  await applySubscriptionFromStripe(payload);

  if (stripeSub.status === 'past_due') {
    await startPaymentGracePeriod(resolvedBusinessId);
  } else if (['active', 'trialing'].includes(stripeSub.status)) {
    await clearPaymentGracePeriod(resolvedBusinessId);
  }

  await enforceGracePeriodExpiry(resolvedBusinessId);

  local = await Subscription.findOne({ business: resolvedBusinessId });
  if (local) await applyPendingDowngradeIfDue(local, stripeSub);
}

async function handleSubscriptionDeleted(stripeSub) {
  const local = await Subscription.findOne({ stripeSubscriptionId: stripeSub.id });
  if (!local) return;
  await downgradeToFree(local.business);
}
