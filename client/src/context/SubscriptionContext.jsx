import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { subscriptionApi } from '../services/subscriptionApi';
import { planHasFeature, STATIC_PLANS } from '../constants/plans';
import { useSubscriptionStripeSync, STRIPE_FLOW_KEY } from '../hooks/useSubscriptionStripeSync';
import { useSubscriptionPaymentReturn } from '../hooks/useSubscriptionPaymentReturn';

const SubscriptionContext = createContext(null);
const FREE_PLAN = { ...STATIC_PLANS.free, id: 'free' };

export function SubscriptionProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const stripeHealthSyncRef = useRef(false);

  const applyPlan = useCallback((planData) => {
    if (planData && typeof planData === 'object') {
      setPlan(planData);
    }
  }, []);

  const reload = useCallback(async () => {
    if (!isAuthenticated) {
      setPlan(null);
      return;
    }
    setLoading(true);
    try {
      const res = await subscriptionApi.current();
      setPlan(res.data?.data || { ...STATIC_PLANS.free, id: 'free' });
    } catch {
      setPlan({ ...STATIC_PLANS.free, id: 'free', status: 'active' });
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const syncAndReload = useCallback(async () => {
    if (!isAuthenticated) {
      return { ok: false, message: 'Not signed in' };
    }
    try {
      const res = await subscriptionApi.sync();
      if (res.data?.data) setPlan(res.data.data);
      await reload();
      return {
        ok: true,
        data: res.data.data,
        message: res.data?.message || 'Subscription synced'
      };
    } catch (err) {
      await reload();
      return {
        ok: false,
        message: err.response?.data?.message || 'Could not sync subscription'
      };
    }
  }, [isAuthenticated, reload]);

  useSubscriptionStripeSync(reload, applyPlan);
  useSubscriptionPaymentReturn({ reload, applyPlan });

  useEffect(() => {
    reload();
  }, [reload, user?.defaultBusinessId]);

  // One background Stripe sync per session — catches missed webhooks (e.g. local dev).
  useEffect(() => {
    if (!isAuthenticated || stripeHealthSyncRef.current || loading || !plan) return;
    if (!plan.stripeConfigured) return;

    let fromStripe = false;
    try {
      fromStripe = Boolean(sessionStorage.getItem(STRIPE_FLOW_KEY));
    } catch {
      /* ignore */
    }

    if ((plan.isPastDue || plan.status === 'past_due') && !fromStripe) return;
    // Free + unlinked: never background-sync (avoids email-matched paid upgrades).
    if (plan.id === 'free' && !plan.stripeLinked && !fromStripe) return;

    stripeHealthSyncRef.current = true;
    (async () => {
      try {
        await subscriptionApi.sync();
        await reload();
      } catch {
        /* no Stripe subscription yet */
      }
    })();
  }, [isAuthenticated, loading, plan, reload]);

  // Poll while past_due so grace expiry downgrades reflect without manual refresh
  useEffect(() => {
    if (!plan?.isPastDue) return undefined;
    const id = setInterval(reload, 60_000);
    return () => clearInterval(id);
  }, [plan?.isPastDue, reload]);

  const value = useMemo(() => {
    const planId = plan?.id || 'free';
    const isPastDue = Boolean(plan?.isPastDue || plan?.status === 'past_due');
    const featurePlan = isPastDue ? FREE_PLAN : plan;

    return {
      plan,
      planId,
      loading,
      reload,
      syncAndReload,
      isPastDue,
      gracePeriodEnd: plan?.gracePeriodEnd || null,
      graceDaysRemaining: plan?.graceDaysRemaining ?? null,
      hasFeature: (key) => planHasFeature(featurePlan, key),
      isFree: isPastDue || planId === 'free',
      isProfessional: !isPastDue && (planId === 'professional' || planId === 'professional_plus'),
      isProfessionalPlus: !isPastDue && planId === 'professional_plus',
      isEnterprise: !isPastDue && planId === 'enterprise',
      canUpgrade: !isPastDue && planId !== 'enterprise'
    };
  }, [plan, loading, reload, syncAndReload]);

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return ctx;
}
