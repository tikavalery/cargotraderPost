import { usePlanUsage } from '../../hooks/usePlanUsage';
import PlanLimitBanner from './PlanLimitBanner';

/** Shows warehouse usage vs plan limit. */
export default function WarehouseLimitBanner() {
  const { planId, warehouseLimit, warehousesUsed } = usePlanUsage();

  return (
    <PlanLimitBanner
      label="Warehouses"
      limit={warehouseLimit}
      used={warehousesUsed}
      planId={planId}
      unit="warehouses"
    />
  );
}
