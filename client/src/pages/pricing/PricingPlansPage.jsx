import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import AppShell from '../../layout/AppShell';
import PlanUpgradeBanner from '../../components/plan/PlanUpgradeBanner';
import DowngradeConfirmModal from '../../components/billing/DowngradeConfirmModal';
import PricingCurrentPlanBadge from '../../components/pricing/PricingCurrentPlanBadge';
import PricingPlanCard from '../../components/pricing/PricingPlanCard';
import { useSubscription } from '../../context/SubscriptionContext';
import { usePermissions } from '../../hooks/usePermissions';
import { usePricingStripeAutoSync } from '../../hooks/usePricingStripeAutoSync';
import { markStripeFlow } from '../../hooks/useSubscriptionStripeSync';
import { useToast } from '../../context/ToastContext';
import { subscriptionApi } from '../../services/subscriptionApi';
import {
  FEATURE_ROWS,
  PLAN_IDS,
  STATIC_PLANS,
  featureDisplay,
  isCurrentPlan,
  isPlanDowngrade,
  mergePlanFromApi
} from '../../constants/plans';
import { useLocale, useT } from '../../i18n/LanguageContext';

export default function PricingPlansPage() {
  const t = useT();
  const locale = useLocale();
  const [interval, setInterval] = useState('month');
  const [plans, setPlans] = useState(Object.values(STATIC_PLANS));
  const [busyPlan, setBusyPlan] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [downgradeTarget, setDowngradeTarget] = useState(null);
  const [downgradeOpen, setDowngradeOpen] = useState(false);
  const [downgrading, setDowngrading] = useState(false);
  const [checkoutHelpOpen, setCheckoutHelpOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const upgradeFeature = location.state?.upgradeFeature;
  const { plan: currentPlan, reload, syncAndReload, loading: planLoading } = useSubscription();
  const { canManageStores } = usePermissions();
  const { showToast } = useToast();

  const handleAutoSyncStart = useCallback(() => setSyncing(true), []);
  const handleAutoSyncEnd = useCallback(() => setSyncing(false), []);
  usePricingStripeAutoSync({ onSyncStart: handleAutoSyncStart, onSyncEnd: handleAutoSyncEnd });

  useEffect(() => {
    subscriptionApi
      .listPlans()
      .then((res) => {
        if (Array.isArray(res.data?.plans) && res.data.plans.length) {
          setPlans(res.data.plans.map((p) => mergePlanFromApi(p)));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const checkout = searchParams.get('checkout');
    if (checkout !== 'canceled') return;

    setCheckoutHelpOpen(true);
    showToast(
      'Payment was not completed. Use the back link on Stripe to return here, or close Stripe and open CargoTrader again.',
      ''
    );
    const next = new URLSearchParams(searchParams);
    next.delete('checkout');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, showToast]);

  const planMap = useMemo(() => {
    const map = {};
    plans.forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [plans]);

  const orderedPlans = PLAN_IDS.map((id) => planMap[id] || STATIC_PLANS[id]);

  async function handleSync() {
    if (!canManageStores) return;
    setSyncing(true);
    try {
      const result = await syncAndReload();
      if (result.ok) {
        showToast(result.message || 'Subscription synced', 'success');
      } else {
        showToast(result.message || 'Could not sync subscription');
      }
    } finally {
      setSyncing(false);
    }
  }

  async function handleChoosePlan(planId) {
    if (!canManageStores) {
      showToast('Only business owners and managers can change plans.');
      return;
    }
    if (isCurrentPlan(currentPlan, planId)) return;

    const target = planMap[planId] || STATIC_PLANS[planId];
    if (isPlanDowngrade(currentPlan?.id, planId)) {
      setDowngradeTarget(target);
      setDowngradeOpen(true);
      return;
    }

    setBusyPlan(planId);
    try {
      const returnUrl = `${window.location.origin}/pricing?portal=return`;
      const res = await subscriptionApi.createCheckoutSession({ planId, interval, returnUrl });
      const mode = res.data?.mode;
      const url = res.data?.url;

      if (mode === 'updated') {
        showToast(res.data?.message || 'Plan upgraded', 'success');
        await reload();
        return;
      }

      if (url && (mode === 'portal' || mode === 'checkout' || !mode)) {
        markStripeFlow(mode === 'portal' ? 'portal' : 'checkout');
        if (mode === 'portal' && res.data?.message) {
          showToast(res.data.message, 'success');
        }
        window.location.href = url;
        return;
      }

      showToast(res.data?.message || 'Could not start plan change. Is Stripe configured?');
    } catch (err) {
      showToast(err.response?.data?.message || 'Unable to change plan');
    } finally {
      setBusyPlan('');
    }
  }

  async function handleConfirmDowngrade() {
    if (!downgradeTarget) return;
    setDowngrading(true);
    try {
      let res;
      if (downgradeTarget.id === 'free') {
        res = await subscriptionApi.selectFree();
      } else {
        try {
          res = await subscriptionApi.downgrade({ planId: downgradeTarget.id });
        } catch (err) {
          if (err.response?.status === 404) {
            try {
              res = await subscriptionApi.selectFree({ planId: downgradeTarget.id });
            } catch {
              showToast('Restart the API server (npm run dev), then try again.');
              return;
            }
          } else {
            throw err;
          }
        }
      }
      if (res.data?.requiresPortal && res.data?.url) {
        showToast(res.data?.message || 'Opening Stripe Billing Portal…', 'success');
        setDowngradeOpen(false);
        setDowngradeTarget(null);
        markStripeFlow('portal');
        window.location.href = res.data.url;
        return;
      }
      showToast(res.data?.message || 'Downgrade scheduled', 'success');
      setDowngradeOpen(false);
      setDowngradeTarget(null);
      await reload();
    } catch (err) {
      showToast(err.response?.data?.message || 'Could not schedule downgrade');
    } finally {
      setDowngrading(false);
    }
  }

  const trialDays =
    plans.find((p) => p.id === 'professional')?.trialPeriodDays ??
    currentPlan?.trialPeriodDays ??
    7;

  function buttonLabel(planId) {
    if (isCurrentPlan(currentPlan, planId)) return t('Current plan');
    if (isPlanDowngrade(currentPlan?.id, planId)) {
      const name = planMap[planId]?.name || STATIC_PLANS[planId]?.name || planId;
      return t('Downgrade to {name}', { name: t(name) });
    }
    if (planId === 'free') return t('Downgrade to Free');
    if (currentPlan?.id && currentPlan.id !== 'free') {
      const name = planMap[planId]?.name || STATIC_PLANS[planId]?.name || 'plan';
      return t('Upgrade to {name}', { name: t(name) });
    }
    if (trialDays > 0 && (!currentPlan?.id || currentPlan.id === 'free')) {
      return t('Start {days}-day free trial', { days: trialDays });
    }
    return t('Choose plan');
  }

  return (
    <AppShell
      hideSearch
      className="app-shell--pricing"
      breadcrumbs={[
        { label: 'CargoTrader', to: '/dashboard' },
        { label: t('Pricing & Plans'), current: true }
      ]}
    >
      <div className="content pricing-page">
        {upgradeFeature && <PlanUpgradeBanner feature={upgradeFeature} />}
        {checkoutHelpOpen && (
          <div className="checkout-help-banner" role="status">
            <i className="fas fa-info-circle" aria-hidden />
            <div>
              <strong>{t('Card declined on Stripe?')}</strong>
              <p>
                {t(
                  "Stripe's checkout page shows its own error message — our app banner appears after you return to CargoTrader. Close the Stripe tab or click the back link, then update payment via Manage billing below."
                )}
              </p>
            </div>
            <button
              type="button"
              className="checkout-help-dismiss"
              onClick={() => setCheckoutHelpOpen(false)}
              aria-label={t('Dismiss')}
            >
              <i className="fas fa-times" />
            </button>
          </div>
        )}
        <header className="pricing-hero page-chrome-dense">
          <div className="pricing-hero-copy">
            <p className="pricing-eyebrow page-chrome-dense-hide">{t('Subscription')}</p>
            <h1 className="pricing-hero-title">{t('Pricing Plans')}</h1>
            <p className="pricing-sub page-chrome-dense-hide">
              {t(
                'Scale CargoTrader as your import business grows. All plans include inventory tracking and staff accounts.'
              )}
              {trialDays > 0 ? (
                <>
                  {' '}
                  {t(
                    'New paid subscriptions include a {days}-day free trial (card required; billed after the trial).',
                    { days: trialDays }
                  )}
                </>
              ) : null}
            </p>
            <p className="pricing-billing-note page-chrome-dense-hide">
              {t(
                'Plan prices are in USD. Inventory and POS amounts in the app can use your preferred currency (for example XAF). Applicable taxes are calculated at Stripe Checkout when tax collection is enabled. See'
              )}{' '}
              <Link to="/terms">{t('Terms of Service')}</Link>
              {' '}
              {t('and')}{' '}
              <Link to="/privacy">{t('Privacy Policy')}</Link>.
            </p>
          </div>
          <p className="pricing-legal-compact">
            <Link to="/terms">{t('Terms of Service')}</Link>
            <span aria-hidden>·</span>
            <Link to="/privacy">{t('Privacy Policy')}</Link>
          </p>
          <PricingCurrentPlanBadge
            currentPlan={currentPlan}
            syncing={syncing}
            planLoading={planLoading}
            canManageStores={canManageStores}
            onSync={handleSync}
          />
        </header>

        <div className="pricing-toggle-wrap">
          <div className="pricing-toggle" role="group" aria-label={t('Billing interval')}>
            <button
              type="button"
              className={`pricing-toggle-btn${interval === 'month' ? ' active' : ''}`}
              onClick={() => setInterval('month')}
            >
              {t('Monthly')}
            </button>
            <button
              type="button"
              className={`pricing-toggle-btn${interval === 'year' ? ' active' : ''}`}
              onClick={() => setInterval('year')}
            >
              {t('Yearly')}
              <span className="pricing-save-badge">{t('Save 20%')}</span>
            </button>
          </div>
        </div>

        <div className="pricing-cards">
          {orderedPlans.map((plan) => (
            <PricingPlanCard
              key={plan.id}
              plan={plan}
              interval={interval}
              trialDays={trialDays}
              isCurrent={isCurrentPlan(currentPlan, plan.id)}
              isBusy={busyPlan === plan.id}
              canManageStores={canManageStores}
              buttonLabel={buttonLabel(plan.id)}
              onChoose={handleChoosePlan}
            />
          ))}
        </div>

        <section className="pricing-compare">
          <h3>{t('Compare all features')}</h3>
          <div className="pricing-table-wrap">
            <table className="pricing-table">
              <thead>
                <tr>
                  <th>{t('Feature')}</th>
                  {orderedPlans.map((p) => (
                    <th key={p.id}>{t(p.name)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURE_ROWS.map((row) => (
                  <tr key={row.key}>
                    <td>{t(row.label)}</td>
                    {orderedPlans.map((p) => (
                      <td key={p.id}>{featureDisplay(p, row, t, locale)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {!canManageStores && (
          <p className="pricing-note">
            <i className="fas fa-info-circle" />{' '}
            {t('Contact your business owner or manager to upgrade the subscription.')}
          </p>
        )}
      </div>

      <DowngradeConfirmModal
        open={downgradeOpen}
        currentPlan={currentPlan}
        targetPlan={downgradeTarget}
        onClose={() => {
          if (downgrading) return;
          setDowngradeOpen(false);
          setDowngradeTarget(null);
        }}
        onConfirm={handleConfirmDowngrade}
        loading={downgrading}
      />
    </AppShell>
  );
}
