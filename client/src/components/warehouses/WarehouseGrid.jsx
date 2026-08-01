import WarehouseCard from './WarehouseCard';

export default function WarehouseGrid({
  warehouses,
  totalCount,
  searchActive,
  selectedId,
  selection,
  toolbarRight,
  onOpen,
  onEdit,
  onDelete
}) {
  if (!warehouses.length) {
    return (
      <div className="empty-grid">
        {searchActive && totalCount > 0 ? 'No warehouses match your search' : 'No warehouses yet — add your first location'}
      </div>
    );
  }

  const {
    selectedIds,
    toggleRow,
    toggleAll,
    visibleIds,
    allVisibleSelected,
    someVisibleSelected
  } = selection || {};

  return (
    <div className="warehouse-grid-wrap">
      {(selection || toolbarRight) && (
        <div className="wh-select-all-bar">
          {selection ? (
            <label>
              <input
                type="checkbox"
                checked={Boolean(allVisibleSelected && warehouses.length)}
                ref={(el) => { if (el) el.indeterminate = Boolean(someVisibleSelected); }}
                onChange={() => toggleAll?.(visibleIds)}
                aria-label="Select all warehouses"
              />
              <span>Select all ({warehouses.length})</span>
            </label>
          ) : <span />}
          {toolbarRight ? <div className="wh-select-all-actions">{toolbarRight}</div> : null}
        </div>
      )}
      <div className="warehouse-grid">
        {warehouses.map((wh) => {
          const sid = wh.selectId || wh.id;
          return (
            <WarehouseCard
              key={sid}
              warehouse={wh}
              selected={selectedId === wh.id}
              checked={Boolean(selectedIds?.has(sid))}
              onToggleSelect={selection ? toggleRow : undefined}
              onOpen={onOpen}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          );
        })}
      </div>
    </div>
  );
}
