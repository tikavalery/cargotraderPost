import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { subscriptionApi } from '../services/subscriptionApi';
import { STRIPE_FLOW_KEY, STRIPE_FLOW_AT_KEY } from './useSubscriptionStripeSync';

const HANDLED_PREFIX = 'afritrade_payment_return_handled_';

/**
 * Global handler for Stripe Checkout success and Customer Portal return on any page.
 */
export function useSubscriptionPaymentReturn({ reload, applyPlan }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const runningRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    const checkout = searchParams.get('checkout');
    const sessionId = searchParams.get('session_id');
    const portalReturn = searchParams.get('portal') === 'return';
    const stripeFlow = sessionStorage.getItem(STRIPE_FLOW_KEY);
    const flowAt = sessionStorage.getItem(STRIPE_FLOW_AT_KEY) || '0';

    if (checkout === 'canceled') return;
    if (!checkout && !sessionId && !portalReturn && !stripeFlow) return;

    const dedupeKey = sessionId
      ? `${HANDLED_PREFIX}checkout_${sessionId}`
      : portalReturn || stripeFlow === 'portal'
        ? `${HANDLED_PREFIX}portal_${flowAt}`
        : stripeFlow === 'checkout'
          ? `${HANDLED_PREFIX}checkout_flow_${flowAt}`
          : null;

    if (dedupeKey && sessionStorage.getItem(dedupeKey) === '1') return;
    if (runningRef.current) return;
    runningRef.current = true;

    async function handleReturn() {
      try {
        if (checkout === 'success' || sessionId) {
          let updated = false;

          if (sessionId) {
            try {
              const res = await subscriptionApi.confirmCheckout({ sessionId });
              if (res.data?.data) applyPlan(res.data.data);
              showToast(res.data?.message || 'Subscription updated successfully!', 'success');
              updated = true;
            } catch (err) {
              showToast(
                err.response?.data?.message ||
                  'Payment received — syncing your plan. If it still shows Free, try Sync my subscription.',
                err.response ? '' : 'success'
              );
            }
          }

          if (!updated) {
            try {
              const res = await subscriptionApi.sync();
              if (res.data?.data) applyPlan(res.data.data);
              if (!sessionId) {
                showToast(res.data?.message || 'Subscription synced', 'success');
              }
            } catch {
              /* sync may fail if no Stripe subscription yet */
            }
          }
        } else if (portalReturn || stripeFlow === 'portal') {
          try {
            const res = await subscriptionApi.sync();
            if (res.data?.data) applyPlan(res.data.data);
            if (res.data?.data?.isPastDue) {
              showToast(
                'Payment is still past due. Update your card in billing to keep your plan.',
                ''
              );
            } else {
              showToast(res.data?.message || 'Billing settings updated', 'success');
            }
          } catch {
            showToast('Welcome back — refreshing your plan…', 'success');
          }
        } else if (stripeFlow === 'checkout') {
          try {
            const res = await subscriptionApi.sync();
            if (res.data?.data) applyPlan(res.data.data);
          } catch {
            /* ignore */
          }
        }
      } finally {
        await reload();
        sessionStorage.removeItem(STRIPE_FLOW_KEY);
        sessionStorage.removeItem(STRIPE_FLOW_AT_KEY);
        if (dedupeKey) sessionStorage.setItem(dedupeKey, '1');

        const next = new URLSearchParams(searchParams);
        if (checkout) next.delete('checkout');
        if (sessionId) next.delete('session_id');
        if (portalReturn) next.delete('portal');
        if (next.toString() !== searchParams.toString()) {
          setSearchParams(next, { replace: true });
        }

        runningRef.current = false;
      }
    }

    handleReturn();
  }, [
    isAuthenticated,
    searchParams,
    setSearchParams,
    showToast,
    reload,
    applyPlan
  ]);
}
