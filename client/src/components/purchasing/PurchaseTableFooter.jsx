import PurchaseBulkActions from './PurchaseBulkActions';

export default function PurchaseTableFooter({
  count,
  selection,
  onExportSelected,
  onPrintSelected,
  onBulkEdit,
  onDelete
}) {
  const plural = count === 1 ? 'purchase' : 'purchases';
  const hasSelection = selection.count > 0;

  return (
    <div className="pur-table-footer">
      <span className="pur-table-count">
        {count} {plural}
      </span>
      {hasSelection ? (
        <PurchaseBulkActions
          count={selection.count}
          onExportSelected={onExportSelected}
          onPrintSelected={onPrintSelected}
          onBulkEdit={onBulkEdit}
          onDelete={onDelete}
        />
      ) : (
        <span className="pur-table-hint">
          Select rows for Export Selected, Print, Edit (one at a time), or Delete
        </span>
      )}
    </div>
  );
}
