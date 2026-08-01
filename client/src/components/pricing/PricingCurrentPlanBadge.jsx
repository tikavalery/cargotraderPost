import ManageBillingButton from '../billing/ManageBillingButton';
import { formatBillingDate } from '../../constants/plans';
import { useT } from '../../i18n/LanguageContext';

/**
 * Current-plan summary on the pricing page (status, renewal, pending downgrade, billing actions).
 */
export default function PricingCurrentPlanBadge({
  currentPlan,
  syncing = false,
  planLoading = false,
  canManageStores = false,
  onSync
}) {
  const t = useT();

  if ((syncing || planLoading) && !currentPlan) {
    return (
      <div className="pricing-current-badge pricing-current-badge-loading" aria-busy="true">
        <span className="pricing-current-label">{t('Current plan')}</span>
        <strong>
          <i className="fas fa-spinner fa-spin" aria-hidden /> {t('Updating from Stripe…')}
        </strong>
      </div>
    );
  }

  if (!currentPlan) return null;

  return (
    <div className="pricing-current-badge" data-testid="pricing-current-badge">
      <span className="pricing-current-label">{t('Current plan')}</span>
      <strong>
        {t(currentPlan.name)}
        {syncing && (
          <span className="pricing-sync-inline">
            <i className="fas fa-spinner fa-spin" aria-hidden /> {t('syncing')}
          </span>
        )}
      </strong>
      {currentPlan.isTrialing && currentPlan.currentPeriodEnd && (
        <span className="pricing-renewal pricing-trial-badge">
          {t('Free trial ends {date}', { date: formatBillingDate(currentPlan.currentPeriodEnd) })}
        </span>
      )}
      {!currentPlan.isTrialing && currentPlan.currentPeriodEnd && (
        <span className="pricing-renewal">
          {currentPlan.cancelAtPeriodEnd
            ? t('Service ends {date}', { date: formatBillingDate(currentPlan.currentPeriodEnd) })
            : t('Renews {date}', { date: formatBillingDate(currentPlan.currentPeriodEnd) })}
        </span>
      )}
      {currentPlan.pendingPlan && (
        <span className="pricing-pending-downgrade">
          {t('Switching to {name} at period end', {
            name: t(currentPlan.pendingPlanName || currentPlan.pendingPlan)
          })}
        </span>
      )}
      {canManageStores && (
        <div className="pricing-badge-actions">
          <button
            type="button"
            className="pricing-sync-link"
            onClick={onSync}
            disabled={syncing || planLoading}
            title={syncing ? t('Syncing…') : t('Refresh from Stripe')}
            aria-label={syncing ? t('Syncing…') : t('Refresh from Stripe')}
          >
            <i className={`fas ${syncing ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`} aria-hidden />
            <span className="pricing-sync-link-label">
              {syncing ? t('Syncing…') : t('Refresh from Stripe')}
            </span>
          </button>
          {currentPlan.id !== 'free' && (
            <ManageBillingButton
              className="btn btn-secondary pricing-billing-btn"
              label={t('Manage billing')}
            />
          )}
        </div>
      )}
    </div>
  );
}
