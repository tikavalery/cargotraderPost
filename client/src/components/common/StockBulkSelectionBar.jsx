/**
 * Shared bulk selection chrome for store / warehouse / shipment stock tables.
 * Desktop: navy inline bar. Phone: fixed bottom dock (inventory-style).
 */
export default function StockBulkSelectionBar({ count, onClear, actions = [] }) {
  if (!count) return null;

  const visible = actions.filter((a) => a && !a.hidden);

  return (
    <>
      <div className="stock-bulk-bar visible">
        <div className="stock-bulk-bar-left">
          {count} selected
        </div>
        <div className="stock-bulk-bar-actions">
          {visible.map((action) => (
            <button
              key={action.key}
              type="button"
              className={action.danger ? 'btn-bulk-delete' : action.clear ? 'btn-bulk-clear-inline' : 'btn-bulk-inline'}
              onClick={action.onClick}
              disabled={action.disabled}
              title={action.title || action.label}
              style={action.danger && !action.clear ? { background: 'var(--danger)' } : undefined}
            >
              {action.icon ? <i className={`fas ${action.icon}`} aria-hidden="true" /> : null}
              {action.label}
            </button>
          ))}
          {onClear && (
            <button type="button" className="btn-bulk-clear-inline" onClick={onClear}>
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="stock-mobile-bulk-dock" role="toolbar" aria-label="Selected item actions">
        <span className="stock-mobile-bulk-count" title={`${count} selected`}>
          {count}
        </span>
        <div className="stock-mobile-bulk-actions">
          {visible.map((action) => (
            <button
              key={`m-${action.key}`}
              type="button"
              className={action.danger ? 'btn-bulk-delete' : 'btn-secondary'}
              onClick={action.onClick}
              disabled={action.disabled}
              title={action.title || action.label}
              aria-label={action.label}
            >
              {action.icon ? <i className={`fas ${action.icon}`} aria-hidden="true" /> : null}
              <span className="stock-mobile-bulk-label">{action.shortLabel || action.label}</span>
            </button>
          ))}
          {onClear && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onClear}
              title="Clear"
              aria-label="Clear selection"
            >
              <i className="fas fa-times" aria-hidden="true" />
              <span className="stock-mobile-bulk-label">Clear</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
}
