import { useT } from '../../i18n/LanguageContext';
import MobileSelectAllBar from '../common/MobileSelectAllBar';
import ShipmentTableRow from './ShipmentTableRow';

export default function ShipmentsTable({
  shipments,
  loading,
  completed,
  statusFilter,
  carrierFilter,
  onStatusFilter,
  onCarrierFilter,
  onView,
  onEdit,
  onDelete,
  onRefreshLocation,
  refreshingLocationId,
  selection,
  bulkBar,
  selectable = false
}) {
  const t = useT();
  const hasSelection = Boolean(selection) && selectable;
  const colCount = hasSelection ? 11 : 10;
  const visibleIds = selection?.visibleIds || [];

  return (
    <div className="ship-card">
      <div className="ship-card-header">
        <div className="ship-card-title">
          <i className="fas fa-list" /> {completed ? t('Completed Shipments') : t('All Shipments')}
        </div>
      </div>
      <div className="table-controls">
        <select className="table-filter-select" value={statusFilter} onChange={(e) => onStatusFilter(e.target.value)}>
          <option value="">{t('By Status')}</option>
          <option value="In Transit">{t('In Transit')}</option>
          <option value="Delayed">{t('Delayed')}</option>
          <option value="At Customs">{t('At Customs')}</option>
          <option value="Arrived">{t('Arrived')}</option>
          <option value="Delivered">{t('Delivered')}</option>
        </select>
        <select className="table-filter-select" value={carrierFilter} onChange={(e) => onCarrierFilter(e.target.value)}>
          <option value="">{t('By Carrier')}</option>
          <option value="COSCO">COSCO</option>
          <option value="MSC">MSC</option>
          <option value="Maersk">Maersk</option>
        </select>
        {hasSelection && selection.count > 0 && (
          <span className="ship-selection-hint">{selection.count} selected</span>
        )}
      </div>

      {hasSelection && selection.count > 0 && bulkBar}

      <div className="ship-table-wrapper">
        {hasSelection && (
          <MobileSelectAllBar
            checked={selection.allVisibleSelected && shipments.length > 0}
            indeterminate={selection.someVisibleSelected}
            onChange={() => selection.toggleAll(visibleIds)}
            disabled={!shipments.length}
            countLabel={
              shipments.length
                ? `${shipments.length} shipment${shipments.length !== 1 ? 's' : ''}`
                : ''
            }
          />
        )}
        <table className="ship-table at-responsive-table">
          <thead>
            <tr>
              {hasSelection && (
                <th className="ship-check-col">
                  <input
                    type="checkbox"
                    checked={selection.allVisibleSelected && shipments.length > 0}
                    ref={(el) => {
                      if (el) el.indeterminate = selection.someVisibleSelected;
                    }}
                    onChange={() => selection.toggleAll(visibleIds)}
                    aria-label="Select all shipments"
                    disabled={!shipments.length}
                  />
                </th>
              )}
              <th>{t('Shipment ID')}</th>
              <th>{t('Items')}</th>
              <th>{t('Origin → Destination')}</th>
              <th>{t('Carrier')}</th>
              <th>{t('Status')}</th>
              <th>{t('Location')}</th>
              <th>{completed ? t('Delivered') : t('ETA')}</th>
              <th>{t('Landed Cost')}</th>
              <th>{t('Updated')}</th>
              <th>{t('Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={colCount} className="ship-empty-cell">
                  <i className="fas fa-spinner fa-spin" /> {t('Loading…')}
                </td>
              </tr>
            )}
            {!loading && !shipments.length && (
              <tr>
                <td colSpan={colCount} className="ship-empty-cell">{t('No shipments found')}</td>
              </tr>
            )}
            {!loading && shipments.map((s) => {
              const sid = s.selectId || s.shipmentId || s.id;
              const selected = hasSelection && selection.selectedIds.has(sid);
              return (
                <ShipmentTableRow
                  key={sid}
                  shipment={s}
                  completed={completed}
                  onView={onView}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onRefreshLocation={onRefreshLocation}
                  refreshingLocationId={refreshingLocationId}
                  selectable={hasSelection}
                  selected={selected}
                  onToggleSelect={hasSelection ? () => selection.toggleRow(sid) : undefined}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
