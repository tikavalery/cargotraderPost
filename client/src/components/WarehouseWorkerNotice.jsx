import { usePermissions } from '../hooks/usePermissions';
import { useWarehouseWorker } from '../context/WarehouseWorkerContext';
import { useT } from '../i18n/LanguageContext';

/** Shown when a warehouse worker has no warehouses assigned yet. */
export default function WarehouseWorkerNotice() {
  const t = useT();
  const { isWarehouseWorker, assignedWarehouseIds, warehouseScopeMessage } = usePermissions();
  const ctx = useWarehouseWorker();

  if (!isWarehouseWorker) return null;

  if (!assignedWarehouseIds.length) {
    return (
      <div
        className="inv-fetch-error"
        style={{
          margin: '0 0 16px',
          padding: '12px 16px',
          borderRadius: 8,
          background: '#fffbeb',
          border: '1px solid #fde68a',
          color: '#92400e',
          fontSize: 14
        }}
        role="alert"
      >
        <strong>{t('No warehouses assigned.')}</strong>{' '}
        {t('Your business owner must assign at least one warehouse under')}{' '}
        <strong>{t('Settings → Users & Staff')}</strong>{' '}
        {t('before you can view inventory.')}
      </div>
    );
  }

  const activeName = ctx?.activeWarehouse?.name;
  const message = ctx?.canSwitch && activeName
    ? t('Viewing stock for {name}. Switch warehouses from the top navbar.', { name: activeName })
    : warehouseScopeMessage;

  if (!message) return null;

  return (
    <div
      className="warehouse-scope-notice"
      style={{
        margin: '0 0 16px',
        padding: '12px 16px',
        borderRadius: 8,
        background: 'rgba(16, 185, 129, 0.08)',
        border: '1px solid rgba(16, 185, 129, 0.35)',
        color: '#065f46',
        fontSize: 14
      }}
      role="status"
    >
      <i className="fas fa-warehouse" style={{ marginRight: 8 }} aria-hidden="true" />
      <strong>{message}</strong>
    </div>
  );
}
