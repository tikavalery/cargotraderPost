import PurchaseTableRow from './PurchaseTableRow';
import PurchaseTableFooter from './PurchaseTableFooter';
import PurchaseBulkActions from './PurchaseBulkActions';
import MobileSelectAllBar from '../common/MobileSelectAllBar';

export default function PurchasesTable({
  rows,
  loading,
  error,
  selection,
  onRowClick,
  onExportSelected,
  onPrintSelected,
  onBulkEdit,
  onBulkDelete,
  readOnly = false
}) {
  const { selectedIds, toggleRow, toggleAll, visibleIds, allVisibleSelected, someVisibleSelected } =
    selection;
  const count = selection.count;
  const selectedRow = selection.selectedRows?.[0];

  return (
    <div className={`pur-table-card${count > 0 ? ' pur-table-card--bulk-dock' : ''}`}>
      {count > 0 && (
        <div className="pur-selection-bar">
          <PurchaseBulkActions
            count={count}
            onExportSelected={onExportSelected}
            onPrintSelected={onPrintSelected}
            onBulkEdit={readOnly ? undefined : onBulkEdit}
            onDelete={readOnly ? undefined : onBulkDelete}
          />
        </div>
      )}

      {/* Phone: fixed bottom dock — matches inventory selection actions */}
      {count > 0 && (
        <div className="pur-mobile-bulk-dock" role="toolbar" aria-label="Selected purchase actions">
          <span className="pur-mobile-bulk-count" title={`${count} selected`}>
            {count}
          </span>
          <div className="pur-mobile-bulk-actions">
            {onExportSelected && (
              <button
                type="button"
                className="pur-bulk-btn"
                onClick={onExportSelected}
                title="Export"
                aria-label="Export"
              >
                <i className="fas fa-download" aria-hidden="true" />
                <span className="pur-mobile-bulk-label">Export</span>
              </button>
            )}
            {onPrintSelected && (
              <button
                type="button"
                className="pur-bulk-btn"
                onClick={onPrintSelected}
                title="Print"
                aria-label="Print"
              >
                <i className="fas fa-print" aria-hidden="true" />
                <span className="pur-mobile-bulk-label">Print</span>
              </button>
            )}
            {onRowClick && (
              <button
                type="button"
                className="pur-bulk-btn"
                disabled={count !== 1 || !selectedRow}
                onClick={() => selectedRow && onRowClick(selectedRow)}
                title="View"
                aria-label="View"
              >
                <i className="fas fa-eye" aria-hidden="true" />
                <span className="pur-mobile-bulk-label">View</span>
              </button>
            )}
            {!readOnly && onBulkEdit && (
              <button
                type="button"
                className="pur-bulk-btn pur-bulk-edit"
                disabled={count !== 1}
                onClick={onBulkEdit}
                title="Edit"
                aria-label="Edit"
              >
                <i className="fas fa-pen" aria-hidden="true" />
                <span className="pur-mobile-bulk-label">Edit</span>
              </button>
            )}
            {!readOnly && onBulkDelete && (
              <button
                type="button"
                className="pur-bulk-btn pur-bulk-delete"
                onClick={onBulkDelete}
                title="Delete"
                aria-label="Delete"
              >
                <i className="fas fa-trash" aria-hidden="true" />
                <span className="pur-mobile-bulk-label">Delete</span>
              </button>
            )}
          </div>
        </div>
      )}

      <div className="pur-table-scroll">
        <MobileSelectAllBar
          checked={allVisibleSelected && rows.length > 0}
          indeterminate={someVisibleSelected}
          onChange={() => toggleAll(visibleIds)}
          disabled={!rows.length}
          countLabel={rows.length ? `${rows.length} purchase${rows.length !== 1 ? 's' : ''}` : ''}
        />
        <table className="pur-data-table at-responsive-table">
          <colgroup>
            <col className="pur-col-check" />
            <col className="pur-col-photo" />
            <col className="pur-col-name" />
            <col className="pur-col-sku" />
            <col className="pur-col-category" />
            <col className="pur-col-supplier" />
            <col className="pur-col-qty" />
            <col className="pur-col-location" />
            <col className="pur-col-price" />
            <col className="pur-col-price" />
            <col className="pur-col-date" />
            <col className="pur-col-status" />
          </colgroup>
          <thead>
            <tr>
              <th className="pur-check-col">
                <input
                  type="checkbox"
                  checked={allVisibleSelected && rows.length > 0}
                  ref={(el) => {
                    if (el) el.indeterminate = someVisibleSelected;
                  }}
                  onChange={() => toggleAll(visibleIds)}
                  aria-label="Select all"
                />
              </th>
              <th className="pur-photo-col">Photo</th>
              <th className="pur-name-col">Item Name</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Supplier</th>
              <th>Qty</th>
              <th>Location</th>
              <th>Purchase Price</th>
              <th>Target Price</th>
              <th>Purchased</th>
              <th>Record Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={12} className="pur-empty-cell">
                  <i className="fas fa-spinner fa-spin" /> Loading purchases…
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={12} className="pur-empty-cell pur-error-cell">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && rows.length === 0 && (
              <tr>
                <td colSpan={12} className="pur-empty-cell">
                  No purchases recorded yet
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              rows.map((p) => (
                <PurchaseTableRow
                  key={p.selectId || p.id}
                  purchase={p}
                  selected={selectedIds.has(p.selectId || p.id)}
                  onToggle={toggleRow}
                  onClick={onRowClick}
                />
              ))}
          </tbody>
        </table>
      </div>
      <PurchaseTableFooter
        count={rows.length}
        selection={selection}
        onExportSelected={onExportSelected}
        onPrintSelected={onPrintSelected}
        onBulkEdit={readOnly ? undefined : onBulkEdit}
        onDelete={readOnly ? undefined : onBulkDelete}
      />
    </div>
  );
}
