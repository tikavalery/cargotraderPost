import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSubscription } from '../../context/SubscriptionContext';
import { usePermissions } from '../../hooks/usePermissions';
import ManageBillingButton from './ManageBillingButton';

const DISMISS_PREFIX = 'afritrade_past_due_dismissed_';

function formatGraceDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Prominent banner when subscription payment failed (past_due).
 * Dismissible for the session only — reappears until payment is resolved.
 */
export default function PaymentFailureBanner() {
  const { plan, isPastDue, graceDaysRemaining, gracePeriodEnd } = useSubscription();
  const { canManageStores } = usePermissions();
  const dismissKey = gracePeriodEnd ? `${DISMISS_PREFIX}${new Date(gracePeriodEnd).toISOString()}` : '';
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!dismissKey) {
      setDismissed(false);
      return;
    }
    setDismissed(sessionStorage.getItem(dismissKey) === '1');
  }, [dismissKey]);

  const daysLabel = useMemo(() => {
    if (graceDaysRemaining == null) return 'limited time';
    if (graceDaysRemaining === 0) return 'today';
    if (graceDaysRemaining === 1) return '1 day';
    return `${graceDaysRemaining} days`;
  }, [graceDaysRemaining]);

  if (!isPastDue || dismissed) return null;

  const handleDismiss = () => {
    if (dismissKey) sessionStorage.setItem(dismissKey, '1');
    setDismissed(true);
  };

  return (
    <div className="payment-failure-banner" role="alert">
      <div className="payment-failure-banner-inner">
        <div className="payment-failure-banner-icon" aria-hidden>
          <i className="fas fa-exclamation-triangle" />
        </div>
        <div className="payment-failure-banner-body">
          <strong>Payment failed — action required</strong>
          <p>
            Your {plan?.name || 'paid'} subscription payment could not be processed. Premium features are
            temporarily disabled. Update your payment method within{' '}
            <strong>{daysLabel}</strong>
            {gracePeriodEnd ? ` (by ${formatGraceDate(gracePeriodEnd)})` : ''} to avoid being downgraded to
            the Free plan.
          </p>
        </div>
        <div className="payment-failure-banner-actions">
          {canManageStores ? (
            <ManageBillingButton
              className="btn btn-sm payment-failure-banner-btn"
              label="Update payment"
            />
          ) : (
            <Link to="/pricing" className="btn btn-sm payment-failure-banner-btn">
              View plans
            </Link>
          )}
          <button type="button" className="payment-failure-banner-dismiss" onClick={handleDismiss} aria-label="Dismiss">
            <i className="fas fa-times" />
          </button>
        </div>
      </div>
    </div>
  );
}
