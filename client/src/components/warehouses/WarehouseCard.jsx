import { statusBadgeClass } from '../../utils/utilizationColors';

export default function WarehouseCard({
  warehouse: wh,
  selected,
  checked = false,
  onToggleSelect,
  onOpen,
  onEdit,
  onDelete
}) {
  const stop = (e) => e.stopPropagation();

  return (
    <div
      className={`wh-card${selected ? ' selected' : ''}${checked ? ' checked' : ''}`}
      onClick={() => onOpen(wh)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(wh)}
    >
      <div className="wh-card-header">
        <div className="wh-card-header-left">
          {onToggleSelect && (
            <label className="wh-card-check" onClick={stop} onKeyDown={stop}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggleSelect(wh.selectId || wh.id)}
                aria-label={`Select ${wh.name}`}
              />
            </label>
          )}
          <div>
            <div className="wh-name">
              <span>{wh.flag}</span> {wh.name}
            </div>
            <div className="wh-address">
              <i className="fas fa-map-marker-alt" /> {wh.address}
            </div>
          </div>
        </div>
        <span className={`badge ${statusBadgeClass(wh.status)}`}>
          {wh.status === 'Critical Capacity' && <i className="fas fa-exclamation-circle" style={{ fontSize: 9 }} />}
          {wh.status === 'Operational' && <i className="fas fa-circle" style={{ fontSize: 6 }} />}
          {wh.status}
        </span>
      </div>
      <div className="wh-card-body">
        <div className="wh-footer">
          <div className="wh-actions">
            <button type="button" className="btn-view-details" onClick={(e) => { stop(e); onOpen(wh); }}>
              Warehouse Inventory
            </button>
            {onEdit && (
              <button type="button" className="icon-action-btn" title="Edit" onClick={(e) => { stop(e); onEdit(wh); }}>
                <i className="fas fa-pen" />
              </button>
            )}
            {onDelete && (
              <button type="button" className="icon-action-btn danger" title="Delete" onClick={(e) => { stop(e); onDelete(wh); }}>
                <i className="fas fa-trash" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
