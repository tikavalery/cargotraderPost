import { Link } from 'react-router-dom';
import { FLAGS } from '../../utils/countryFlags';
import Td from '../common/Td';
import MobileSelectAllBar from '../common/MobileSelectAllBar';

function supplierId(s) {
  return s.supplierId || s.id || s._id;
}

export default function SuppliersTable({
  suppliers,
  loading,
  error,
  selection,
  canManage,
  onView,
  onEdit,
  onDelete,
  onExportSelected,
  onBulkDelete
}) {
  const {
    selectedIds,
    toggleRow,
    toggleAll,
    visibleIds,
    allVisibleSelected,
    someVisibleSelected,
    count
  } = selection;

  const colCount = canManage ? 8 : 7;

  return (
    <div className="pur-table-card">
      {count > 0 && (
        <div className="pur-selection-bar">
          <div className="pur-bulk-actions">
            <span className="pur-bulk-count">{count} selected</span>
            <button type="button" className="pur-bulk-btn" onClick={onExportSelected}>
              <i className="fas fa-download" /> Export Selected
            </button>
            {canManage && onBulkDelete && (
              <button type="button" className="pur-bulk-btn pur-bulk-delete" onClick={onBulkDelete}>
                <i className="fas fa-trash" /> Delete Selected
              </button>
            )}
          </div>
        </div>
      )}
      <div className="pur-table-scroll">
        <MobileSelectAllBar
          checked={allVisibleSelected && suppliers.length > 0}
          indeterminate={someVisibleSelected}
          onChange={() => toggleAll(visibleIds)}
          disabled={!suppliers.length}
          countLabel={
            suppliers.length ? `${suppliers.length} supplier${suppliers.length !== 1 ? 's' : ''}` : ''
          }
        />
        <table className="pur-data-table sup-dir-table at-responsive-table">
          <thead>
            <tr>
              <th className="pur-check-col">
                <input
                  type="checkbox"
                  checked={allVisibleSelected && suppliers.length > 0}
                  ref={(el) => {
                    if (el) el.indeterminate = someVisibleSelected;
                  }}
                  onChange={() => toggleAll(visibleIds)}
                  aria-label="Select all"
                />
              </th>
              <th>Supplier</th>
              <th>Location</th>
              <th>Contact</th>
              <th>Rating</th>
              <th>Purchases</th>
              <th>Total Value</th>
              {canManage && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={colCount} className="pur-empty-cell">
                  <i className="fas fa-spinner fa-spin" /> Loading suppliers…
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={colCount} className="pur-empty-cell pur-error-cell">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && suppliers.length === 0 && (
              <tr>
                <td colSpan={colCount} className="pur-empty-cell">
                  No suppliers yet. Add your first supplier to use on purchase records.
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              suppliers.map((s) => {
                const id = supplierId(s);
                const isSelected = selectedIds.has(id);
                return (
                  <tr
                    key={id}
                    onClick={() => onView(s)}
                    className={`sup-row-clickable${isSelected ? ' row-selected' : ''}`}
                  >
                    <Td
                      label=""
                      hideLabel
                      className="pur-check-col"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(id)}
                        aria-label={`Select ${s.name}`}
                      />
                    </Td>
                    <Td label="Supplier">
                      <div className="sup-name">
                        {FLAGS[s.country] || ''} {s.name}
                      </div>
                      <div className="sup-email">{s.supplierId}</div>
                    </Td>
                    <Td label="Location">{[s.city, s.country].filter(Boolean).join(', ') || '—'}</Td>
                    <Td label="Contact">
                      {s.email && <div className="sup-email">{s.email}</div>}
                      {s.phone && <div className="sup-email">{s.phone}</div>}
                      {!s.email && !s.phone && '—'}
                    </Td>
                    <Td label="Rating">★ {Number(s.rating || 4).toFixed(1)}</Td>
                    <Td label="Purchases">
                      {(s.purchaseCount ?? 0) > 0 ? (
                        <Link
                          to={`/purchasing/all?supplier=${encodeURIComponent(s.supplierId)}`}
                          className="sup-purchase-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {s.purchaseCount}
                        </Link>
                      ) : (
                        '0'
                      )}
                    </Td>
                    <Td label="Total Value" className="value-cell">
                      {s.totalPurchaseValue ? `$${Number(s.totalPurchaseValue).toLocaleString('en-US')}` : '—'}
                    </Td>
                    {canManage && (
                      <Td label="Actions" className="at-card-actions" onClick={(e) => e.stopPropagation()}>
                        <div className="sup-row-actions">
                          <button type="button" className="pur-bulk-btn" onClick={() => onEdit(s)}>
                            <i className="fas fa-pen" /> Edit
                          </button>
                          <button
                            type="button"
                            className="pur-bulk-btn pur-bulk-delete"
                            onClick={() => onDelete(s)}
                            disabled={(s.purchaseCount ?? 0) > 0}
                            title={
                              (s.purchaseCount ?? 0) > 0
                                ? 'Remove linked purchases before deleting'
                                : 'Delete supplier'
                            }
                          >
                            <i className="fas fa-trash" />
                          </button>
                        </div>
                      </Td>
                    )}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      {count === 0 && (
        <div className="pur-table-footer">
          <span className="pur-table-hint">Select rows for Export Selected or Delete Selected</span>
        </div>
      )}
    </div>
  );
}
