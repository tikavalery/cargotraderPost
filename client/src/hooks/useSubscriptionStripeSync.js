import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { subscriptionApi } from '../services/subscriptionApi';

const SYNC_COOLDOWN_MS = 15_000;
export const STRIPE_FLOW_KEY = 'afritrade_stripe_flow';
export const STRIPE_FLOW_AT_KEY = 'afritrade_stripe_flow_at';

/** Mark that the user opened Stripe Checkout or Portal (call before redirect). */
export function markStripeFlow(type = 'checkout') {
  try {
    sessionStorage.setItem(STRIPE_FLOW_KEY, type);
    sessionStorage.setItem(STRIPE_FLOW_AT_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/**
 * When the user returns from Stripe (tab focus / visibility), sync subscription from Stripe API.
 * Webhooks often miss localhost — this ensures past_due + grace banner appear in the app.
 */
export function useSubscriptionStripeSync(reload, applyPlan) {
  const { isAuthenticated } = useAuth();
  const lastSyncRef = useRef(0);

  const syncWithStripe = useCallback(async () => {
    if (!isAuthenticated) return;

    const now = Date.now();
    if (now - lastSyncRef.current < SYNC_COOLDOWN_MS) {
      await reload();
      return;
    }
    lastSyncRef.current = now;

    try {
      const res = await subscriptionApi.sync();
      if (res.data?.data) applyPlan?.(res.data.data);
    } catch {
      /* no subscription yet is ok */
    }
    await reload();

    try {
      sessionStorage.removeItem(STRIPE_FLOW_KEY);
      sessionStorage.removeItem(STRIPE_FLOW_AT_KEY);
    } catch {
      /* ignore */
    }
  }, [isAuthenticated, reload, applyPlan]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const fromStripe = sessionStorage.getItem(STRIPE_FLOW_KEY);
      if (fromStripe) syncWithStripe();
    };

    if (sessionStorage.getItem(STRIPE_FLOW_KEY)) {
      syncWithStripe();
    }

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [isAuthenticated, syncWithStripe]);

  return syncWithStripe;
}
