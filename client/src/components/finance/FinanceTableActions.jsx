export function canModifyFinanceEntry(row) {
  return row.auto === false || row.status === 'Recorded';
}

export default function FinanceTableActions({ row, onView, onEdit, onDelete }) {
  const editable = canModifyFinanceEntry(row);

  return (
    <div className="fin-table-actions">
      <button type="button" className="tbl-btn tbl-btn-view" onClick={() => onView(row)} aria-label="View" title="View">
        <i className="fas fa-eye" />
      </button>
      <button
        type="button"
        className={`tbl-btn tbl-btn-edit${editable ? '' : ' is-disabled'}`}
        onClick={() => onEdit(row)}
        aria-label="Edit"
        title={editable ? 'Edit' : 'Auto-synced — cannot edit'}
      >
        <i className="fas fa-pen" />
      </button>
      <button
        type="button"
        className={`tbl-btn tbl-btn-delete${editable ? '' : ' is-disabled'}`}
        onClick={() => onDelete(row)}
        aria-label="Delete"
        title={editable ? 'Delete' : 'Auto-synced — cannot delete'}
      >
        <i className="fas fa-trash" />
      </button>
    </div>
  );
}
