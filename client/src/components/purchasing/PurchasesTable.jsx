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

  return (
    <div className="pur-table-card">
      {selection.count > 0 && (
        <div className="pur-selection-bar">
          <PurchaseBulkActions
            count={selection.count}
            onExportSelected={onExportSelected}
            onPrintSelected={onPrintSelected}
            onBulkEdit={readOnly ? undefined : onBulkEdit}
            onDelete={readOnly ? undefined : onBulkDelete}
          />
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
