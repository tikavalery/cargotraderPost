import { Navigate, Outlet } from 'react-router-dom';
import { useSubscription } from '../../context/SubscriptionContext';

/**
 * Blocks routes when the current subscription plan does not include a feature.
 * Backend still enforces limits — this is UX-only gating.
 */
export default function PlanGate({ feature, redirectTo = '/pricing' }) {
  const { hasFeature, loading } = useSubscription();

  if (loading) {
    return (
      <div className="content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <i className="fas fa-spinner fa-spin" /> Loading plan…
      </div>
    );
  }

  if (!hasFeature(feature)) {
    return <Navigate to={redirectTo} replace state={{ upgradeFeature: feature }} />;
  }

  return <Outlet />;
}
