import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import AppShell from '../../layout/AppShell';
import AccountantReadOnlyNotice from '../../components/AccountantReadOnlyNotice';
import { usePermissions } from '../../hooks/usePermissions';
import { useSyncedSearch } from '../../context/SearchContext';
import { useToast } from '../../context/ToastContext';
import { useT } from '../../i18n/LanguageContext';
import { useShipments } from '../../hooks/useShipments';
import { usePurchaseSelection } from '../../hooks/usePurchaseSelection';
import { shippingApi } from '../../services/shippingApi';
import { filterShipments } from '../../utils/shipmentStatusBadge';
import ShippingNavbarExtras from '../../components/shipping/ShippingNavbarExtras';
import ShipmentFilterChips from '../../components/shipping/ShipmentFilterChips';
import ShipmentsTable from '../../components/shipping/ShipmentsTable';
import ShipmentPagination from '../../components/shipping/ShipmentPagination';
import NewShipmentModal from '../../components/shipping/NewShipmentModal';
import ShipmentDetailModal from '../../components/shipping/ShipmentDetailModal';
import PlanLimitBanner from '../../components/plan/PlanLimitBanner';
import { usePlanUsage } from '../../hooks/usePlanUsage';
import { exportShipmentsCsv, printShipmentsReport } from '../../utils/shipmentExport';

export default function ActiveShipmentsPage() {
  const t = useT();
  const { user } = useAuth();
  const { canManageShipments, canManageInventory, canViewCost, isOperationsReadOnly } = usePermissions();
  const { showToast } = useToast();
  const { search } = useSyncedSearch();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { shipments, pagination, loading, refetch, remove } = useShipments({
    mode: 'active',
    page,
    limit: pageSize
  });
  const { planId, shipmentLimit, shipmentsUsed, atShipmentLimit, reload: reloadUsage } = usePlanUsage();
  const [chip, setChip] = useState('All');
  const [statusFilter, setStatusFilter] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('');
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [editShipment, setEditShipment] = useState(null);
  const [detail, setDetail] = useState(null);
  const [refreshingLocationId, setRefreshingLocationId] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const locationHydrateAttempted = useRef(false);

  const filtered = useMemo(
    () => filterShipments(shipments, { search, statusChip: chip, statusFilter, carrierFilter }),
    [shipments, search, chip, statusFilter, carrierFilter]
  );

  const selectableShipments = useMemo(
    () => filtered.map((s) => ({ ...s, selectId: s.shipmentId || s.id })),
    [filtered]
  );

  const selection = usePurchaseSelection(selectableShipments);

  useEffect(() => {
    setPage(1);
  }, [chip, statusFilter, carrierFilter, search]);

  useEffect(() => {
    selection.clearSelection();
  }, [chip, statusFilter, carrierFilter, search, page, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Fill empty Location cells once from mock/live carrier (existing shipments start blank). */
  useEffect(() => {
    if (loading || locationHydrateAttempted.current) return;

    const needLocation = shipments.filter(
      (s) =>
        !s.currentCity &&
        !s.currentCountry &&
        !s.isTraveler &&
        String(s.trackingNumber || s.container || '').trim().length >= 4
    );

    if (!needLocation.length) {
      locationHydrateAttempted.current = true;
      return;
    }

    locationHydrateAttempted.current = true;
    let cancelled = false;

    (async () => {
      for (const s of needLocation.slice(0, 12)) {
        if (cancelled) break;
        const id = s.shipmentId || s.id;
        try {
          await shippingApi.refreshTracking(id, { advanceMock: false });
        } catch {
          /* shipment may lack a valid tracking number */
        }
      }
      if (!cancelled) refetch({ soft: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, shipments, refetch]);

  const delayedCount = shipments.filter((s) => s.status === 'Delayed').length;
  const routes = new Set(shipments.map((s) => `${s.origin}-${s.dest}`)).size;
  const businessName = user?.businessName || 'ThriftShip Cameroon';

  const handleNewShipment = () => {
    if (atShipmentLimit) {
      showToast(
        shipmentLimit != null
          ? `Your plan allows ${shipmentLimit} shipment${shipmentLimit === 1 ? '' : 's'} per year (${shipmentsUsed} used). Existing shipments are kept — upgrade to create more.`
          : 'Shipment limit reached. Upgrade your plan to add more.'
      );
      return;
    }
    setNewOpen(true);
  };

  const handleEdit = async (s) => {
    setDetail(null);
    try {
      const res = await shippingApi.get(s.shipmentId || s.id);
      setEditShipment(res.data?.data || s);
    } catch {
      setEditShipment(s);
      showToast('Could not load full shipment details — using list preview', 'warning');
    }
  };

  const handleUpdated = (updated) => {
    refetch();
    if (detail && (detail.shipmentId || detail.id) === (updated.shipmentId || updated.id)) {
      setDetail(updated);
    }
  };

  const handleDelete = async (s) => {
    if (!window.confirm(`Delete shipment ${s.shipmentId}?`)) return;
    try {
      await remove(s.shipmentId || s.id);
      showToast('Shipment deleted', 'success');
      selection.clearSelection();
    } catch (e) {
      showToast(e.response?.data?.message || 'Delete failed');
    }
  };

  const handleExportAll = () => {
    if (!filtered.length) {
      showToast('No shipments to export');
      return;
    }
    const ok = exportShipmentsCsv(filtered, {
      filename: `active-shipments-${filtered.length}.csv`
    });
    if (ok) showToast(`Exported ${filtered.length} shipment(s)`, 'success');
  };

  const handlePrintDocs = () => {
    if (!filtered.length) {
      showToast('No shipments to print');
      return;
    }
    const ok = printShipmentsReport(filtered, { title: 'Active Shipments Report' });
    if (!ok) showToast('Allow pop-ups to print documents');
  };

  const handleMarkArrived = async (s) => {
    const id = s.shipmentId || s.id;
    try {
      const res = await shippingApi.updateStatus(id, {
        status: 'Arrived',
        note: 'Marked arrived'
      });
      const updated = res.data?.data || { ...s, status: 'Arrived' };
      showToast('Shipment marked as arrived', 'success');
      setDetail(updated);
      refetch();
    } catch (e) {
      showToast(e.response?.data?.message || 'Could not mark shipment as arrived');
      throw e;
    }
  };

  const handleRefreshLocation = async (s) => {
    const id = s.shipmentId || s.id;
    if (!id) return;
    setRefreshingLocationId(id);
    try {
      const res = await shippingApi.refreshTracking(id);
      const data = res.data || {};
      if (!data.ok) {
        showToast(data.error || 'Could not refresh location from carrier');
        return;
      }
      const place =
        data.currentLocation ||
        [data.currentCity, data.currentCountry].filter(Boolean).join(', ');
      showToast(
        place ? `Location updated: ${place}` : 'Tracking refreshed',
        'success'
      );
      refetch();
      if (detail && (detail.shipmentId || detail.id) === id && data.shipment) {
        setDetail(data.shipment);
      }
    } catch (e) {
      showToast(e.response?.data?.message || e.response?.data?.error || 'Location refresh failed');
    } finally {
      setRefreshingLocationId('');
    }
  };

  const handleExportSelected = () => {
    const rows = selection.selectedRows;
    if (!rows.length) {
      showToast('Select shipments to export');
      return;
    }
    const ok = exportShipmentsCsv(rows, {
      filename: `active-shipments-selected-${rows.length}.csv`
    });
    if (ok) showToast(`Exported ${rows.length} selected shipment(s)`, 'success');
  };

  const handlePrintSelected = () => {
    const rows = selection.selectedRows;
    if (!rows.length) {
      showToast('Select shipments to print');
      return;
    }
    const ok = printShipmentsReport(rows, { title: 'Selected Active Shipments' });
    if (!ok) showToast('Allow pop-ups to print documents');
  };

  const handleMarkArrivedSelected = async () => {
    const rows = selection.selectedRows;
    if (!rows.length || !canManageShipments) return;
    const pending = rows.filter(
      (s) => s.status !== 'Arrived' && s.status !== 'Delivered' && s.status !== 'Closed'
    );
    if (!pending.length) {
      showToast('Selected shipments are already arrived or completed');
      return;
    }
    if (!window.confirm(`Mark ${pending.length} shipment(s) as Arrived?`)) return;
    setBulkBusy(true);
    let okCount = 0;
    try {
      for (const s of pending) {
        const id = s.shipmentId || s.id;
        try {
          await shippingApi.updateStatus(id, { status: 'Arrived', note: 'Marked arrived (bulk)' });
          okCount += 1;
        } catch {
          /* continue remaining */
        }
      }
      if (okCount) {
        showToast(
          okCount === pending.length
            ? `Marked ${okCount} shipment(s) as arrived`
            : `Marked ${okCount} of ${pending.length} shipment(s) as arrived`,
          'success'
        );
        selection.clearSelection();
        refetch();
      } else {
        showToast('Could not mark shipments as arrived');
      }
    } finally {
      setBulkBusy(false);
    }
  };

  const handleDeleteSelected = async () => {
    const rows = selection.selectedRows;
    if (!rows.length || !canManageShipments) return;
    if (!window.confirm(`Delete ${rows.length} selected shipment(s)? This cannot be undone.`)) {
      return;
    }
    setBulkBusy(true);
    let okCount = 0;
    try {
      for (const s of rows) {
        const id = s.shipmentId || s.id;
        try {
          await remove(id);
          okCount += 1;
        } catch {
          /* continue remaining */
        }
      }
      if (okCount) {
        showToast(
          okCount === rows.length
            ? `Deleted ${okCount} shipment(s)`
            : `Deleted ${okCount} of ${rows.length} shipment(s)`,
          'success'
        );
        selection.clearSelection();
        refetch();
        reloadUsage();
      } else {
        showToast('Could not delete selected shipments');
      }
    } finally {
      setBulkBusy(false);
    }
  };

  const openViewSelected = () => {
    const row = selection.selectedRows[0];
    if (row) setDetail(row);
  };

  const bulkBar = (
    <div className="stock-bulk-bar visible doc-bulk-bar ship-bulk-bar">
      <div className="stock-bulk-bar-left">{selection.count} selected</div>
      <div className="stock-bulk-bar-actions">
        <button
          type="button"
          className="btn-bulk-inline"
          onClick={handleExportSelected}
          disabled={bulkBusy}
        >
          <i className="fas fa-download" /> Export Selected
        </button>
        <button
          type="button"
          className="btn-bulk-inline"
          onClick={handlePrintSelected}
          disabled={bulkBusy}
        >
          <i className="fas fa-print" /> Print Selected
        </button>
        {selection.count === 1 && (
          <button type="button" className="btn-bulk-inline" onClick={openViewSelected} disabled={bulkBusy}>
            <i className="fas fa-eye" /> View
          </button>
        )}
        {canManageShipments && (
          <button
            type="button"
            className="btn-bulk-inline"
            onClick={handleMarkArrivedSelected}
            disabled={bulkBusy}
          >
            <i className={`fas ${bulkBusy ? 'fa-spinner fa-spin' : 'fa-map-marker-alt'}`} /> Mark Arrived
          </button>
        )}
        {canManageShipments && (
          <button
            type="button"
            className="btn-bulk-inline btn-bulk-delete"
            onClick={handleDeleteSelected}
            disabled={bulkBusy}
          >
            <i className="fas fa-trash" /> Delete Selected
          </button>
        )}
        <button
          type="button"
          className="btn-bulk-clear-inline"
          onClick={selection.clearSelection}
          disabled={bulkBusy}
        >
          Clear
        </button>
      </div>
    </div>
  );

  return (
    <>
      <AppShell
        className="app-shell--shipping"
        searchPlaceholder={t('Search by tracking number, shipment ID…')}
        breadcrumbs={[
          { label: 'CargoTrader', to: '/dashboard' },
          { label: 'Shipping', to: '/shipping' },
          { label: 'Logistics', current: true }
        ]}
        navbarRight={<ShippingNavbarExtras showNewShipment={canManageShipments} onNewShipment={handleNewShipment} />}
      >
        <div className="content ship-page ship-list-page ship-active-page">
          <div className="page-header">
            <div className="ship-list-title-block">
              <h1>{t('Shipments & Logistics')}</h1>
              <p className="page-header-sub">
                {businessName} · {t('Active tracking across {count} routes', { count: routes || 4 })}
              </p>
            </div>
            <div className="page-header-right">
              {canManageShipments && (
                <button
                  type="button"
                  className="btn-new-shipment ship-mobile-new-shipment"
                  onClick={handleNewShipment}
                  title={t('New Shipment')}
                  aria-label={t('New Shipment')}
                >
                  <i className="fas fa-plus" aria-hidden />
                  <span className="ship-chrome-label">{t('New Shipment')}</span>
                </button>
              )}
              <button
                type="button"
                className="btn-ghost"
                onClick={handlePrintDocs}
                title={t('Print Docs')}
                aria-label={t('Print Docs')}
              >
                <i className="fas fa-print" />
                <span className="ship-chrome-label">{t('Print Docs')}</span>
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={handleExportAll}
                title={t('Export All Shipments')}
                aria-label={t('Export All Shipments')}
              >
                <i className="fas fa-file-excel" />
                <span className="ship-chrome-label">{t('Export All Shipments')}</span>
              </button>
              <ShipmentFilterChips value={chip} onChange={setChip} />
            </div>
          </div>

          <AccountantReadOnlyNotice module="shipping" />

          <PlanLimitBanner
            label={t('Shipments this year')}
            limit={shipmentLimit}
            used={shipmentsUsed}
            planId={planId}
          />

          {delayedCount > 0 && !alertDismissed && (
            <div className="alert-banner">
              <i className="fas fa-exclamation-triangle alert-icon" />
              <span className="alert-banner-text">
                <strong>
                  {delayedCount > 1
                    ? t('{count} shipments are delayed', { count: delayedCount })
                    : t('{count} shipment is delayed', { count: delayedCount })}
                </strong>
                {' '}{t('— review ETA and customs status.')}
              </span>
              <button type="button" className="alert-banner-link" onClick={() => setChip('Delayed')}>{t('Review →')}</button>
              <button type="button" className="alert-dismiss" onClick={() => setAlertDismissed(true)}><i className="fas fa-times" /></button>
            </div>
          )}

          <ShipmentsTable
            shipments={selectableShipments}
            loading={loading}
            statusFilter={statusFilter}
            carrierFilter={carrierFilter}
            onStatusFilter={setStatusFilter}
            onCarrierFilter={setCarrierFilter}
            onView={setDetail}
            onEdit={canManageShipments ? handleEdit : undefined}
            onDelete={canManageShipments ? handleDelete : undefined}
            onRefreshLocation={handleRefreshLocation}
            refreshingLocationId={refreshingLocationId}
            selectable
            selection={selection}
            bulkBar={bulkBar}
          />
          <ShipmentPagination
            page={page}
            pages={pagination.pages || 1}
            total={pagination.total ?? filtered.length}
            pageSize={pagination.limit || pageSize}
            onPage={setPage}
            onPageSize={(size) => { setPageSize(size); setPage(1); }}
            disabled={loading}
          />
        </div>

        <ShipmentDetailModal
          open={Boolean(detail)}
          shipment={detail}
          onClose={() => setDetail(null)}
          onItemsChanged={refetch}
          onShipmentUpdated={(updated) => {
            setDetail(updated);
            refetch();
          }}
          readOnly={!canManageInventory || isOperationsReadOnly}
          canViewCost={canViewCost}
          showToast={showToast}
          onMarkArrived={canManageShipments ? handleMarkArrived : undefined}
        />
      </AppShell>

      {canManageShipments && (
        <NewShipmentModal
          open={newOpen}
          onClose={() => setNewOpen(false)}
          onCreated={() => { refetch(); reloadUsage(); }}
          showToast={showToast}
        />
      )}
      <NewShipmentModal
        open={Boolean(editShipment) && canManageShipments}
        shipment={editShipment}
        onClose={() => setEditShipment(null)}
        onUpdated={handleUpdated}
        showToast={showToast}
      />
    </>
  );
}
