import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { usePermissions } from './usePermissions';
import { useSubscription } from '../context/SubscriptionContext';
import { STRIPE_FLOW_KEY } from './useSubscriptionStripeSync';

const FOCUS_SYNC_COOLDOWN_MS = 60_000;

function returningFromStripe() {
  try {
    return Boolean(sessionStorage.getItem(STRIPE_FLOW_KEY));
  } catch {
    return false;
  }
}

/**
 * On the pricing page, pull the latest subscription from Stripe automatically
 * (managers/owners). Re-syncs when the tab becomes visible again (cooldown).
 *
 * Free accounts that are not linked to Stripe are NOT auto-synced — syncing by
 * email previously could attach another subscription and upgrade them without a click.
 */
export function usePricingStripeAutoSync({ onSyncStart, onSyncEnd } = {}) {
  const location = useLocation();
  const { canManageStores } = usePermissions();
  const { plan, syncAndReload, reload } = useSubscription();
  const lastFocusSyncRef = useRef(0);
  const runningRef = useRef(false);

  useEffect(() => {
    if (location.pathname !== '/pricing') return undefined;

    let cancelled = false;

    async function runSync() {
      if (runningRef.current) return;
      runningRef.current = true;
      onSyncStart?.();

      try {
        const fromStripe = returningFromStripe();
        const isFree = !plan?.id || plan.id === 'free';
        const stripeLinked = Boolean(plan?.stripeLinked);
        // Only auto-sync when there is something to sync, or the user just returned from Stripe.
        const shouldSyncWithStripe =
          canManageStores && (!isFree || stripeLinked || fromStripe);

        if (shouldSyncWithStripe) {
          await syncAndReload();
        } else {
          await reload();
        }
      } finally {
        runningRef.current = false;
        if (!cancelled) onSyncEnd?.();
      }
    }

    runSync();

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastFocusSyncRef.current < FOCUS_SYNC_COOLDOWN_MS) return;
      lastFocusSyncRef.current = now;
      runSync();
    };

    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [
    location.pathname,
    canManageStores,
    plan?.id,
    plan?.stripeLinked,
    syncAndReload,
    reload,
    onSyncStart,
    onSyncEnd
  ]);
}
