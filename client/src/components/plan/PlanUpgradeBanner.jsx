import { Link } from 'react-router-dom';

const FEATURE_LABELS = {
  purchases: 'Purchases & Sourcing',
  shipping: 'Shipping Management',
  pos: 'POS / Stores & Sales',
  purchaseAiFill: 'AI Assistants (Purchase & Expense)'
};

/** Inline notice when a feature requires a plan upgrade. */
export default function PlanUpgradeBanner({ feature, compact = false }) {
  const label = FEATURE_LABELS[feature] || 'This feature';

  if (compact) {
    return (
      <Link to="/pricing" state={{ upgradeFeature: feature }} className="plan-upgrade-pill">
        <i className="fas fa-lock" /> Upgrade for {label}
      </Link>
    );
  }

  return (
    <div className="plan-upgrade-banner">
      <div className="plan-upgrade-banner-icon">
        <i className="fas fa-crown" />
      </div>
      <div className="plan-upgrade-banner-body">
        <strong>{feature === 'purchaseAiFill' ? 'AI Assistants need a paid plan' : `${label} isn't available on your current plan`}</strong>
        <p>
          {feature === 'purchaseAiFill'
            ? 'Upgrade to Professional (6,000 AI analyses/month) or Professional Plus (20,000/month) to unlock AI Purchase and Expense Assistants.'
            : 'Free includes core modules with limits. Upgrade to Professional or higher for more capacity and premium features.'}
        </p>
      </div>
      <Link to="/pricing" state={{ upgradeFeature: feature }} className="btn btn-primary plan-upgrade-banner-btn">
        View plans
      </Link>
    </div>
  );
}
