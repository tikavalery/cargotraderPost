import { usePlanUsage } from '../../hooks/usePlanUsage';
import PlanLimitBanner from './PlanLimitBanner';

/** Shows staff/users usage vs plan limit (members + pending invites). */
export default function UserLimitBanner() {
  const { planId, userLimit, usersUsed } = usePlanUsage();

  return (
    <PlanLimitBanner
      label="Users"
      limit={userLimit}
      used={usersUsed}
      planId={planId}
      unit="users"
    />
  );
}
