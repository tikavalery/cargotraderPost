import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import { stripeApi } from '../../services/stripeApi';
import { markStripeFlow } from '../../hooks/useSubscriptionStripeSync';

/**
 * Opens Stripe Customer Portal (update card, cancel plan, view invoices).
 * Requires manageBusiness permission — hide or disable when user cannot manage billing.
 */
export default function ManageBillingButton({
  className = 'btn btn-secondary pricing-billing-btn',
  label = 'Manage billing',
  disabled = false,
  onBeforeRedirect
}) {
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();
  const location = useLocation();

  const handleClick = async () => {
    setLoading(true);
    try {
      const returnUrl = `${window.location.origin}${location.pathname}?portal=return`;
      const res = await stripeApi.createCustomerPortal({ returnUrl });
      const url = res.data?.url;
      if (!url) {
        showToast('Could not open billing portal. Is Stripe configured?');
        return;
      }
      onBeforeRedirect?.();
      markStripeFlow('portal');
      window.location.href = url;
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not open billing portal');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button type="button" className={className} disabled={disabled || loading} onClick={handleClick}>
      {loading ? (
        <>
          <i className="fas fa-spinner fa-spin" aria-hidden /> Opening portal…
        </>
      ) : (
        <>
          <i className="fas fa-credit-card" aria-hidden /> {label}
        </>
      )}
    </button>
  );
}
