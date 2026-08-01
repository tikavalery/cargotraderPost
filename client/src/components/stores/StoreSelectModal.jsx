import { usePosStore } from '../../context/PosStoreContext';

export default function StoreSelectModal({ open, onClose }) {
  const { stores, storeId, setStoreId } = usePosStore();

  const select = (id) => {
    setStoreId(id);
    onClose();
  };

  return (
    <div className={`pos-modal-overlay${open ? ' open' : ''}`} onClick={onClose} role="presentation">
      <div className="pos-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="pos-modal-header">
          <div className="pos-modal-title">Select Store</div>
          <button type="button" className="pos-modal-close" onClick={onClose} aria-label="Close"><i className="fas fa-times" /></button>
        </div>
        <div className="pos-modal-body">
          {stores.map((s) => (
            <div
              key={s.storeId}
              className={`pos-store-list-item${s.storeId === storeId ? ' active' : ''}`}
              onClick={() => select(s.storeId)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && select(s.storeId)}
            >
              <span style={{ fontSize: 24 }}>{s.icon || '🏪'}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{s.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{s.address}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
