import { useWarehouseWorker } from '../../context/WarehouseWorkerContext';
import { useT } from '../../i18n/LanguageContext';

export default function WarehouseSelectModal({ open, onClose }) {
  const t = useT();
  const ctx = useWarehouseWorker();
  if (!ctx) return null;
  const { warehouses, warehouseId, setWarehouseId } = ctx;

  const select = (id) => {
    setWarehouseId(id);
    onClose();
  };

  return (
    <div className={`pos-modal-overlay${open ? ' open' : ''}`} onClick={onClose} role="presentation">
      <div className="pos-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="pos-modal-header">
          <div className="pos-modal-title">{t('Select Warehouse')}</div>
          <button type="button" className="pos-modal-close" onClick={onClose} aria-label={t('Close')}>
            <i className="fas fa-times" />
          </button>
        </div>
        <div className="pos-modal-body">
          {!warehouses.length ? (
            <p style={{ fontSize: 13, color: 'var(--text-light)', margin: 0 }}>{t('No warehouses assigned.')}</p>
          ) : (
            warehouses.map((w) => {
              const id = String(w._id || w.warehouseId || w.id);
              const active =
                id === String(warehouseId) ||
                String(w.warehouseId) === String(warehouseId) ||
                String(w.id) === String(warehouseId);
              return (
                <div
                  key={id}
                  className={`pos-store-list-item${active ? ' active' : ''}`}
                  onClick={() => select(id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && select(id)}
                >
                  <span style={{ fontSize: 24 }}>{w.flag || '🏭'}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{w.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-light)' }}>
                      {w.address || w.country || w.warehouseId || ''}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
