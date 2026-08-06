import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import AppShell from '../../layout/AppShell';
import { usePermissions } from '../../hooks/usePermissions';
import { useSyncedSearch } from '../../context/SearchContext';
import { useToast } from '../../context/ToastContext';
import { useShipments } from '../../hooks/useShipments';
import { usePurchaseSelection } from '../../hooks/usePurchaseSelection';
import { filterShipments } from '../../utils/shipmentStatusBadge';
import ShippingNavbarExtras from '../../components/shipping/ShippingNavbarExtras';
import ShipmentFilterChips from '../../components/shipping/ShipmentFilterChips';
import ShipmentsTable from '../../components/shipping/ShipmentsTable';
import ShipmentPagination from '../../components/shipping/ShipmentPagination';
import { shippingApi } from '../../services/shippingApi';
import NewShipmentModal from '../../components/shipping/NewShipmentModal';
import ShipmentDetailModal from '../../components/shipping/ShipmentDetailModal';
import { exportShipmentsCsv, printShipmentsReport } from '../../utils/shipmentExport';

export default function CompletedShipmentsPage() {
  const { user } = useAuth();
  const { canManageShipments, canManageInventory, canViewCost, isOperationsReadOnly } = usePermissions();
  const { showToast } = useToast();
  const { search } = useSyncedSearch();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { shipments, pagination, loading, refetch } = useShipments({
    mode: 'completed',
    page,
    limit: pageSize
  });
  const [chip, setChip] = useState('All');
  const [statusFilter, setStatusFilter] = useState('');
  const [carrierFilter, setCarrierFilter] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [editShipment, setEditShipment] = useState(null);
  const [detail, setDetail] = useState(null);
  const [refreshingLocationId, setRefreshingLocationId] = useState('');

  useEffect(() => {
    setPage(1);
  }, [chip, statusFilter, carrierFilter, search]);

  const filtered = useMemo(() => {
    let rows = filterShipments(shipments, { search, statusFilter, carrierFilter });
    if (chip === 'Delivered') rows = rows.filter((s) => s.status === 'Delivered');
    else if (chip === 'Offloaded') rows = rows.filter((s) => s.status === 'Offloaded');
    else if (chip === 'Closed') rows = rows.filter((s) => s.status === 'Closed');
    else if (chip === '2025') rows = rows.filter((s) => (s.shipmentId || '').includes('2025'));
    return rows;
  }, [shipments, search, chip, statusFilter, carrierFilter]);

  const selectableShipments = useMemo(
    () => filtered.map((s) => ({ ...s, selectId: s.shipmentId || s.id })),
    [filtered]
  );

  const selection = usePurchaseSelection(selectableShipments);

  useEffect(() => {
    selection.clearSelection();
  }, [chip, statusFilter, carrierFilter, search]); // eslint-disable-line react-hooks/exhaustive-deps

  const businessName = user?.businessName || 'ThriftShip Cameroon';

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

  const handleExportAll = () => {
    if (!filtered.length) {
      showToast('No shipments to export');
      return;
    }
    const ok = exportShipmentsCsv(filtered, {
      filename: `completed-shipments-${filtered.length}.csv`
    });
    if (ok) showToast(`Exported ${filtered.length} shipment(s)`, 'success');
  };

  const handlePrintDocs = () => {
    if (!filtered.length) {
      showToast('No shipments to print');
      return;
    }
    const ok = printShipmentsReport(filtered, { title: 'Completed Shipments Report' });
    if (!ok) showToast('Allow pop-ups to print documents');
  };

  const handleExportSelected = () => {
    const rows = selection.selectedRows;
    if (!rows.length) {
      showToast('Select shipments to export');
      return;
    }
    const ok = exportShipmentsCsv(rows, {
      filename: `completed-shipments-selected-${rows.length}.csv`
    });
    if (ok) showToast(`Exported ${rows.length} selected shipment(s)`, 'success');
  };

  const handlePrintSelected = () => {
    const rows = selection.selectedRows;
    if (!rows.length) {
      showToast('Select shipments to print');
      return;
    }
    const ok = printShipmentsReport(rows, { title: 'Selected Completed Shipments' });
    if (!ok) showToast('Allow pop-ups to print documents');
  };

  const openViewSelected = () => {
    const row = selection.selectedRows[0];
    if (row) setDetail(row);
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
      showToast(place ? `Location updated: ${place}` : 'Tracking refreshed', 'success');
      refetch({ soft: true });
    } catch (e) {
      showToast(e.response?.data?.message || e.response?.data?.error || 'Location refresh failed');
    } finally {
      setRefreshingLocationId('');
    }
  };

  const bulkBar = (
    <div className="stock-bulk-bar visible doc-bulk-bar ship-bulk-bar">
      <div className="stock-bulk-bar-left">{selection.count} selected</div>
      <div className="stock-bulk-bar-actions">
        <button type="button" className="btn-bulk-inline" onClick={handleExportSelected}>
          <i className="fas fa-download" /> Export Selected
        </button>
        <button type="button" className="btn-bulk-inline" onClick={handlePrintSelected}>
          <i className="fas fa-print" /> Print Selected
        </button>
        {selection.count === 1 && (
          <button type="button" className="btn-bulk-inline" onClick={openViewSelected}>
            <i className="fas fa-eye" /> View
          </button>
        )}
        <button type="button" className="btn-bulk-clear-inline" onClick={selection.clearSelection}>
          Clear
        </button>
      </div>
    </div>
  );

  return (
    <>
      <AppShell
        className="app-shell--shipping"
        searchPlaceholder="Search by tracking number, shipment ID…"
        breadcrumbs={[
          { label: 'CargoTrader', to: '/dashboard' },
          { label: 'Shipping', to: '/shipping' },
          { label: 'Logistics', to: '/shipping' },
          { label: 'Completed', current: true }
        ]}
        navbarRight={<ShippingNavbarExtras showNewShipment={canManageShipments} onNewShipment={() => setNewOpen(true)} />}
      >
        <div className="content ship-page ship-list-page ship-completed-page">
          <div className="page-header">
            <div className="ship-list-title-block">
              <h1>Completed Shipments</h1>
              <p className="page-header-sub">{businessName} · {shipments.length} delivered shipments · archive &amp; offload records</p>
            </div>
            <div className="page-header-right">
              <button
                type="button"
                className="btn-ghost"
                onClick={handlePrintDocs}
                title="Print Docs"
                aria-label="Print Docs"
              >
                <i className="fas fa-print" />
                <span className="ship-chrome-label">Print Docs</span>
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={handleExportAll}
                title="Export All Shipments"
                aria-label="Export All Shipments"
              >
                <i className="fas fa-file-excel" />
                <span className="ship-chrome-label">Export All Shipments</span>
              </button>
              <ShipmentFilterChips variant="completed" value={chip} onChange={setChip} />
            </div>
          </div>

          <ShipmentsTable
            shipments={selectableShipments}
            loading={loading}
            completed
            statusFilter={statusFilter}
            carrierFilter={carrierFilter}
            onStatusFilter={setStatusFilter}
            onCarrierFilter={setCarrierFilter}
            onView={setDetail}
            onEdit={canManageShipments ? handleEdit : undefined}
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
          completed
          readOnly={!canManageInventory || isOperationsReadOnly}
          canViewCost={canViewCost}
          showToast={showToast}
        />
      </AppShell>

      {canManageShipments && (
        <NewShipmentModal open={newOpen} onClose={() => setNewOpen(false)} onCreated={() => refetch()} showToast={showToast} />
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
