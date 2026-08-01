import { Link } from 'react-router-dom';
import { formatUsdAmount } from '../../utils/formatUsd';
import { shipmentStatusBadgeClass } from '../../utils/shipmentStatusBadge';
import Td from '../common/Td';

function formatLocationUpdated(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  } catch {
    return '';
  }
}

function CargoLocationCell({ shipment: s, onRefreshLocation, refreshing }) {
  const label =
    s.currentLocation ||
    [s.currentCity, s.currentCountry].filter(Boolean).join(', ') ||
    '';
  const updated = formatLocationUpdated(s.lastLocationUpdate);
  const hasTracking = Boolean(String(s.trackingNumber || s.container || '').trim());
  const canRefresh = hasTracking && !s.isTraveler;

  return (
    <div className="ship-location-cell">
      <div className="ship-location-main">
        <i className="fas fa-map-marker-alt ship-location-icon" aria-hidden />
        <div className="ship-location-text">
          {label ? (
            <>
              <span className="ship-location-place">{label}</span>
              {updated ? <span className="ship-location-updated">Updated {updated}</span> : null}
            </>
          ) : (
            <span className="ship-location-empty">
              {canRefresh
                ? 'No location yet — refresh'
                : hasTracking
                  ? '—'
                  : 'Add tracking #'}
            </span>
          )}
        </div>
      </div>
      {canRefresh && onRefreshLocation ? (
        <button
          type="button"
          className="ship-location-refresh"
          onClick={(e) => {
            e.stopPropagation();
            onRefreshLocation(s);
          }}
          disabled={refreshing}
          title="Refresh location from carrier (mock or live API)"
          aria-label="Refresh cargo location"
        >
          <i className={`fas ${refreshing ? 'fa-spinner fa-spin' : 'fa-sync-alt'}`} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function ShipmentActions({ shipment: s, onView, onEdit, onDelete, completed, stop }) {
  return (
    <div className="action-cell" onClick={stop}>
      <button
        type="button"
        className="tbl-btn tbl-btn-icon tbl-btn-view"
        onClick={(e) => { e.stopPropagation(); onView(s); }}
        aria-label="View shipment"
        title="View"
      >
        <i className="fas fa-eye" aria-hidden />
      </button>
      {onEdit && (
        <button
          type="button"
          className="tbl-btn tbl-btn-icon tbl-btn-edit"
          onClick={(e) => { e.stopPropagation(); onEdit?.(s); }}
          aria-label="Edit shipment"
          title="Edit"
        >
          <i className="fas fa-pen" aria-hidden />
        </button>
      )}
      <Link
        to={`/shipping/documents?shipment=${s.shipmentId || s.id}`}
        className="tbl-btn tbl-btn-icon tbl-btn-docs"
        onClick={stop}
        aria-label="View documents"
        title="Documents"
      >
        <i className="fas fa-file-alt" aria-hidden />
      </Link>
      {!completed && onDelete && (
        <button
          type="button"
          className="tbl-btn tbl-btn-icon tbl-btn-delete"
          onClick={(e) => { e.stopPropagation(); onDelete(s); }}
          aria-label="Delete shipment"
          title="Delete"
        >
          <i className="fas fa-trash" aria-hidden />
        </button>
      )}
    </div>
  );
}

export default function ShipmentTableRow({
  shipment: s,
  onView,
  onEdit,
  onDelete,
  onRefreshLocation,
  refreshingLocationId,
  completed,
  selectable = false,
  selected = false,
  onToggleSelect
}) {
  const stop = (e) => e.stopPropagation();
  const etaLabel = completed ? 'Delivered' : 'ETA';
  const rowId = s.shipmentId || s.id;
  const refreshing = refreshingLocationId === rowId;

  const handleRowClick = (e) => {
    if (e.target.closest('.action-cell, .at-card-actions, .ship-location-refresh, .ship-check-cell')) return;
    onView(s);
  };

  return (
    <tr
      className={`${s.rowTint || ''}${selected ? ' selected-row' : ''}`.trim()}
      onClick={handleRowClick}
      style={{ cursor: 'pointer' }}
    >
      {selectable && (
        <Td label="" hideLabel className="ship-check-cell" onClick={stop}>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect?.()}
            aria-label={`Select shipment ${rowId}`}
          />
        </Td>
      )}
      <Td label="Shipment ID">
        <span className="ship-id-cell">{s.shipmentId || s.id}</span>
      </Td>
      <Td label="Items" className="ship-items-col">
        <strong>{s.items ?? 0}</strong>
      </Td>
      <Td label="Origin → Destination">
        <div className="route-cell">
          <span className="route-leg">{s.originFlag} {s.origin}</span>
          <span className="route-arrow" aria-hidden><i className="fas fa-long-arrow-alt-right" /></span>
          <span className="route-leg">{s.destFlag} {s.dest}</span>
          {(s.shippingMethod === 'traveler' || s.isTraveler) && (
            <i className="fas fa-plane route-traveler-icon" aria-hidden />
          )}
        </div>
      </Td>
      <Td label="Carrier" className="carrier-cell">
        <span className="carrier-name">{s.carrier}</span>
        {s.isTraveler && <span className="badge badge-traveler">Traveler</span>}
      </Td>
      <Td label="Status">
        <span className={`badge ${shipmentStatusBadgeClass(s.status)}`}>
          {s.status === 'In Transit' && <i className="fas fa-circle" style={{ fontSize: 6 }} />}
          {s.status === 'Delayed' && <i className="fas fa-exclamation-triangle" style={{ fontSize: 9 }} />}
          {s.status === 'Arrived' && <i className="fas fa-check" style={{ fontSize: 9 }} />}
          {s.status}
        </span>
      </Td>
      <Td label="Location" className="location-cell">
        <CargoLocationCell
          shipment={s}
          onRefreshLocation={onRefreshLocation}
          refreshing={refreshing}
        />
      </Td>
      <Td label={etaLabel} className="eta-cell">
        {completed ? (
          <>
            {s.eta}
            <i className="fas fa-check" style={{ color: 'var(--success)', fontSize: 9, marginLeft: 4 }} />
          </>
        ) : (
          <>
            {s.status === 'Delayed' && <span style={{ color: 'var(--danger)' }}>* </span>}
            {s.eta}
          </>
        )}
      </Td>
      <Td label="Landed Cost" className="cost-cell">{formatUsdAmount(s.landedCostUsd)}</Td>
      <Td label="Updated" className="updated-cell">{s.updated}</Td>
      <Td label="Actions" className="at-card-actions">
        <ShipmentActions
          shipment={s}
          onView={onView}
          onEdit={onEdit}
          onDelete={onDelete}
          completed={completed}
          stop={stop}
        />
      </Td>
    </tr>
  );
}
