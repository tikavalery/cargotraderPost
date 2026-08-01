export default function PurchaseBulkActions({
  count,
  onExportSelected,
  onPrintSelected,
  onBulkEdit,
  onDelete
}) {
  if (count < 1) return null;

  return (
    <div className="pur-bulk-actions">
      <span className="pur-bulk-count">{count} selected</span>
      {onExportSelected && (
        <button type="button" className="pur-bulk-btn" onClick={onExportSelected}>
          <i className="fas fa-download" /> Export Selected
        </button>
      )}
      {onPrintSelected && (
        <button type="button" className="pur-bulk-btn" onClick={onPrintSelected}>
          <i className="fas fa-print" /> Print Selected Purchases
        </button>
      )}
      {onBulkEdit && (
        <button
          type="button"
          className="pur-bulk-btn pur-bulk-edit"
          disabled={count !== 1}
          onClick={onBulkEdit}
          title={count !== 1 ? 'Select exactly one purchase to edit' : 'Edit selected purchase'}
        >
          <i className="fas fa-pen" /> Edit
        </button>
      )}
      {onDelete && (
        <button type="button" className="pur-bulk-btn pur-bulk-delete" onClick={onDelete}>
          <i className="fas fa-trash" /> Delete Selected
        </button>
      )}
    </div>
  );
}
