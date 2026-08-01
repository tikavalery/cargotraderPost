import { Link } from 'react-router-dom';
import { useSubscription } from '../../context/SubscriptionContext';
import { usePlanUsage } from '../../hooks/usePlanUsage';
import { STATIC_PLANS, formatBillingDate } from '../../constants/plans';
import { useT } from '../../i18n/LanguageContext';

/** Compact plan status + AI usage for the main dashboard. */
export default function PlanStatusCard() {
  const t = useT();
  const { plan, planId, isPastDue, loading } = useSubscription();
  const { aiLimit, aiUsed, aiRemaining, atAiLimit } = usePlanUsage();

  const name = plan?.name || STATIC_PLANS[planId]?.name || 'Free';
  const status = isPastDue ? 'Past due' : plan?.isTrialing ? 'Trial' : plan?.status || 'active';
  const hasAi = planId !== 'free' && !isPastDue && (aiLimit == null || aiLimit > 0);

  return (
    <section className="dash-card dash-plan-status" aria-label={t('Subscription plan')}>
      <div className="dash-plan-status-top">
        <div>
          <p className="dash-plan-eyebrow">{t('Your plan')}</p>
          <h2 className="dash-plan-name">
            {loading ? t('Loading…') : name}
            <span className={`dash-plan-status-pill${isPastDue ? ' warn' : ''}`}>{status}</span>
          </h2>
          {plan?.currentPeriodEnd && planId !== 'free' && (
            <p className="dash-plan-meta">
              {plan.cancelAtPeriodEnd
                ? `${t('Ends')} ${formatBillingDate(plan.currentPeriodEnd)}`
                : `${t('Renews')} ${formatBillingDate(plan.currentPeriodEnd)}`}
            </p>
          )}
          {plan?.pendingPlanName && (
            <p className="dash-plan-meta dash-plan-pending">
              {t('Switching to')} {plan.pendingPlanName} {t('at period end')}
            </p>
          )}
        </div>
        <Link to="/pricing" className="btn btn-secondary btn-sm">
          {planId === 'enterprise' ? t('Manage plan') : t('Upgrade / change plan')}
        </Link>
      </div>

      {hasAi && (
        <div className={`dash-plan-ai${atAiLimit ? ' warn' : ''}`}>
          <div className="dash-plan-ai-label">
            <i className="fas fa-wand-magic-sparkles" aria-hidden />
            <span>{t('AI Purchase Assistant')}</span>
          </div>
          {aiLimit == null ? (
            <strong>{t('Unlimited')}</strong>
          ) : (
            <strong>
              {aiUsed} / {aiLimit}
              <span className="dash-plan-ai-remaining">
                {' '}
                ({aiRemaining} {t('remaining this month')})
              </span>
            </strong>
          )}
          {atAiLimit && (
            <Link to="/pricing" className="dash-plan-ai-upgrade">
              {planId === 'professional'
                ? t('Upgrade to Professional Plus (20,000 AI/month)')
                : t('Upgrade to Enterprise for unlimited AI')}
            </Link>
          )}
        </div>
      )}

      {!hasAi && !isPastDue && planId === 'free' && (
        <p className="dash-plan-ai-hint">
          {t('AI Purchase Assistant is available on Professional (6,000/month) and Professional Plus (20,000/month).')}{' '}
          <Link to="/pricing">{t('View plans')}</Link>
        </p>
      )}
    </section>
  );
}
