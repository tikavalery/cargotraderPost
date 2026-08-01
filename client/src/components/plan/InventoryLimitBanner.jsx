import { usePlanUsage } from '../../hooks/usePlanUsage';
import PlanLimitBanner from './PlanLimitBanner';

/** Shows inventory usage vs plan limit on the items page. */
export default function InventoryLimitBanner() {
  const { planId, inventoryLimit, inventoryUsed } = usePlanUsage();

  return (
    <PlanLimitBanner
      label="Inventory"
      limit={inventoryLimit}
      used={inventoryUsed}
      planId={planId}
      unit="items"
    />
  );
}
