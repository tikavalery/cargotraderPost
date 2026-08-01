import { Link } from 'react-router-dom';
import { STATIC_PLANS } from '../../constants/plans';

/**
 * Shows resource usage vs plan limit.
 * Grandfather policy: when over limit after downgrade, existing data is kept;
 * only new creates are blocked — copy makes that explicit.
 */
export default function PlanLimitBanner({ label, limit, used, planId, unit = '' }) {
  if (limit == null) return null;

  const overLimit = used > limit;
  const atLimit = used >= limit;
  const planLabel = STATIC_PLANS[planId]?.name || planId || 'Current';
  const unitSuffix = unit ? ` ${unit}` : '';

  return (
    <div
      className={`plan-usage-banner${atLimit ? ' plan-usage-banner-warn' : ''}${
        overLimit ? ' plan-usage-banner-over' : ''
      }`}
      role="status"
    >
      <div>
        <strong>
          {label}: {used} / {limit}
          {unitSuffix}
        </strong>
        <span> ({planLabel} plan)</span>
        {overLimit ? (
          <p className="plan-usage-policy">
            You&apos;re over this plan&apos;s limit after a downgrade. Existing {label.toLowerCase()} stay
            available — remove some or upgrade to add new ones.
          </p>
        ) : atLimit ? (
          <p className="plan-usage-policy">
            Limit reached. Existing {label.toLowerCase()} are kept; upgrade or free up space to add more.
          </p>
        ) : null}
      </div>
      {atLimit ? (
        <Link to="/pricing" className="btn btn-primary btn-sm">
          Upgrade plan
        </Link>
      ) : (
        <span className="plan-usage-remaining">
          {limit - used} remaining
        </span>
      )}
    </div>
  );
}
