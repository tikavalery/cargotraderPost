import { useNavigate } from 'react-router-dom';
import { storeStatusBadgeClass } from '../../utils/utilizationColors';

export default function StoreCard({ store, onEdit, onDelete }) {
  const navigate = useNavigate();
  const badgeCls = storeStatusBadgeClass(store.status);

  const stop = (e) => e.stopPropagation();

  const id = store.storeId || store.id;
  const openPos = () => {
    if (!id) return;
    localStorage.setItem('afritrade:pos-store', id);
    navigate(`/stores/pos?store=${encodeURIComponent(id)}`);
  };

  const openInventory = () => {
    if (!id) return;
    localStorage.setItem('afritrade:pos-store', id);
    navigate(`/stores/inventory?store=${encodeURIComponent(id)}`);
  };

  return (
    <div className={`store-card${!store.active ? ' inactive' : ''}`}>
      <div className="store-card-header">
        <div>
          <div className="store-name">
            <span>{store.flag || store.icon}</span> {store.name}
          </div>
          <div className="store-address">
            <i className="fas fa-map-marker-alt" /> {store.address}
          </div>
        </div>
        <span className={`badge ${badgeCls}`}>
          {store.status === 'Open' && <i className="fas fa-circle" style={{ fontSize: 6 }} />}
          {store.status}
        </span>
      </div>
      <div className="store-card-body">
        <div className="store-footer">
          <div className="store-quick-links">
            <button type="button" className="btn-open-pos" onClick={openPos}>
              <i className="fas fa-cash-register" /> Open POS
            </button>
            <button type="button" className="btn-store-inventory" onClick={openInventory}>
              <i className="fas fa-boxes" /> Inventory
            </button>
          </div>
          <div className="store-actions">
            <button type="button" className="icon-action-btn" title="Edit" onClick={(e) => { stop(e); onEdit(store); }}>
              <i className="fas fa-pen" />
            </button>
            <button type="button" className="icon-action-btn danger" title="Delete store" onClick={(e) => { stop(e); onDelete(store); }}>
              <i className="fas fa-trash" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
