import { useState } from 'react';
import { usePermissions } from '../../hooks/usePermissions';
import { useWarehouseWorker } from '../../context/WarehouseWorkerContext';
import WarehouseSelectModal from './WarehouseSelectModal';
import { useT } from '../../i18n/LanguageContext';

/** Assigned warehouse badge / switcher for warehouse workers — top navbar. */
export default function WarehouseWorkerNavbarPill() {
  const t = useT();
  const { isWarehouseWorker, assignedWarehouseIds, assignedWarehousesLabel } = usePermissions();
  const ctx = useWarehouseWorker();
  const [open, setOpen] = useState(false);

  if (!isWarehouseWorker || !assignedWarehouseIds.length) return null;

  const canSwitch = Boolean(ctx?.canSwitch);
  const activeName = ctx?.activeWarehouse?.name;
  const label = activeName || assignedWarehousesLabel || t('Your warehouse');

  if (!canSwitch) {
    return (
      <span
        className="pos-store-pill clerk-store-pill warehouse-worker-pill"
        title={t('Your assigned warehouse')}
      >
        <span aria-hidden="true">{ctx?.activeWarehouse?.flag || '🏭'}</span>
        <span>{label}</span>
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        className="pos-store-pill warehouse-worker-pill warehouse-worker-pill-switch"
        onClick={() => setOpen(true)}
        title={t('Change warehouse')}
      >
        <span aria-hidden="true">{ctx?.activeWarehouse?.flag || '🏭'}</span>
        <span>{label}</span>
        <i className="fas fa-chevron-down" style={{ fontSize: 10, color: 'var(--text-light)' }} />
      </button>
      <WarehouseSelectModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
