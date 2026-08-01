import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import { useSubscription } from '../context/SubscriptionContext';
import { subscriptionApi } from '../services/subscriptionApi';

/** After Stripe Customer Portal redirect (?portal=return), sync and refresh plan. */
export function useStripePortalReturn() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const { reload } = useSubscription();

  useEffect(() => {
    if (searchParams.get('portal') !== 'return') return;

    async function handlePortalReturn() {
      try {
        const res = await subscriptionApi.sync();
        const data = res.data?.data;
        await reload();
        if (data?.isPastDue) {
          showToast(
            'Payment is still past due. Update your card in billing to keep your plan.',
            ''
          );
        } else {
          showToast(res.data?.message || 'Billing settings updated', 'success');
        }
      } catch {
        await reload();
        showToast('Welcome back — refreshing your plan…', 'success');
      }
      searchParams.delete('portal');
      setSearchParams(searchParams, { replace: true });
    }

    handlePortalReturn();
  }, [searchParams, setSearchParams, showToast, reload]);
}
