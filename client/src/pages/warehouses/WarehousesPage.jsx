import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useWarehouseWorker, warehouseMatches } from '../../context/WarehouseWorkerContext';
import WarehouseWorkerNotice from '../../components/WarehouseWorkerNotice';
import AccountantReadOnlyNotice from '../../components/AccountantReadOnlyNotice';
import { useToast } from '../../context/ToastContext';
import { useSyncedSearch } from '../../context/SearchContext';
import { useT } from '../../i18n/LanguageContext';
import AppShell from '../../layout/AppShell';
import { warehousesApi } from '../../api';
import { useWarehouses, filterWarehouses } from '../../hooks/useWarehouses';
import { useStores } from '../../hooks/useStores';
import { useShipments } from '../../hooks/useShipments';
import { useWarehouseDetail } from '../../hooks/useWarehouseDetail';
import { usePurchaseSelection } from '../../hooks/usePurchaseSelection';
import { emitInventoryChanged } from '../../utils/inventoryEvents';
import { exportWarehousesCsv } from '../../utils/warehouseExport';
import WarehouseGrid from '../../components/warehouses/WarehouseGrid';
import AddEditWarehouseModal from '../../components/warehouses/AddEditWarehouseModal';
import WarehouseDetailPanel from '../../components/warehouses/WarehouseDetailPanel';
import TransferModal from '../../components/warehouses/TransferModal';
import WarehouseLimitBanner from '../../components/plan/WarehouseLimitBanner';
import { usePlanUsage } from '../../hooks/usePlanUsage';

const BREADCRUMBS = [
  { label: 'CargoTrader', to: '/dashboard' },
  { label: 'Warehouses', current: true }
];

export default function WarehousesPage() {
  const t = useT();
  const { user } = useAuth();
  const { canManageWarehouses, canManageInventory } = usePermissions();
  const warehouseCtx = useWarehouseWorker();
  const { showToast } = useToast();
  const { search } = useSyncedSearch();
  const [searchParams, setSearchParams] = useSearchParams();
  const receiveForStoreId = searchParams.get('receiveFor') || '';
  const { warehouses, meta, loading, error, refetch } = useWarehouses();
  const {
    warehouseLimit,
    atWarehouseLimit,
    reload: reloadUsage
  } = usePlanUsage();
  const { stores: allStores, refetch: refetchStores } = useStores({ lite: true });
  const { shipments: activeShipments } = useShipments({ mode: 'active', limit: 100 });
  const [selectedId, setSelectedId] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editWh, setEditWh] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferCtx, setTransferCtx] = useState({ from: null, items: [] });
  const [transferTick, setTransferTick] = useState(0);
  const [preferredStoreId, setPreferredStoreId] = useState('');
  const [detailCategory, setDetailCategory] = useState('');
  const [detailSearch, setDetailSearch] = useState('');
  const [detailSearchDebounced, setDetailSearchDebounced] = useState('');
  const [detailPage, setDetailPage] = useState(1);
  const [detailPageSize, setDetailPageSize] = useState(25);

  const filtered = useMemo(() => {
    let list = filterWarehouses(warehouses, search).map((w) => ({ ...w, selectId: w.id }));
    if (warehouseCtx?.isWarehouseWorker && warehouseCtx?.warehouseId) {
      list = list.filter((w) => warehouseMatches(w, warehouseCtx.warehouseId));
    }
    return list;
  }, [warehouses, search, warehouseCtx?.isWarehouseWorker, warehouseCtx?.warehouseId]);
  const selection = usePurchaseSelection(filtered);

  useEffect(() => {
    if (!warehouseCtx?.isWarehouseWorker || !warehouseCtx?.warehouseId || !detailOpen) return;
    const match = warehouses.find((w) => warehouseMatches(w, warehouseCtx.warehouseId));
    if (match && selectedId !== match.id) {
      setSelectedId(match.id);
    }
  }, [
    warehouseCtx?.isWarehouseWorker,
    warehouseCtx?.warehouseId,
    warehouses,
    detailOpen,
    selectedId
  ]);

  useEffect(() => {
    const id = setTimeout(() => setDetailSearchDebounced(detailSearch.trim()), 300);
    return () => clearTimeout(id);
  }, [detailSearch]);

  useEffect(() => {
    setDetailPage(1);
  }, [detailCategory, detailSearchDebounced, selectedId]);

  const detail = useWarehouseDetail(detailOpen ? selectedId : null, {
    category: detailCategory,
    search: detailSearchDebounced,
    page: detailPage,
    limit: detailPageSize,
    paginated: true
  });

  const businessName = user?.businessName || 'ThriftShip Cameroon';
  const subtitle = `${businessName} · ${meta.locationCount || warehouses.length} locations across ${meta.countryCount || 1} countries`;

  const openAddWarehouse = () => {
    if (atWarehouseLimit) {
      showToast(
        warehouseLimit != null
          ? `Your plan allows up to ${warehouseLimit} warehouse${warehouseLimit === 1 ? '' : 's'}. Existing warehouses are kept — upgrade or remove one to add another.`
          : 'Warehouse limit reached. Upgrade your plan to add more.'
      );
      return;
    }
    setAddOpen(true);
  };

  const openDetail = (wh) => {
    setSelectedId(wh.id);
    setDetailCategory('');
    setDetailSearch('');
    setDetailSearchDebounced('');
    setDetailPage(1);
    setDetailPageSize(25);
    setDetailOpen(true);
  };

  const closeDetail = () => {
    setDetailOpen(false);
  };

  const handleAdd = async (form) => {
    if (atWarehouseLimit) {
      showToast(
        warehouseLimit != null
          ? `Your plan allows up to ${warehouseLimit} warehouse${warehouseLimit === 1 ? '' : 's'}. Existing warehouses are kept — upgrade or remove one to add another.`
          : 'Warehouse limit reached. Upgrade your plan to add more.'
      );
      return;
    }
    setSaving(true);
    try {
      const res = await warehousesApi.create(form);
      showToast(`Warehouse added: ${res.data.data.name}`, 'success');
      setAddOpen(false);
      refetch();
      reloadUsage();
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to add warehouse');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (form) => {
    setSaving(true);
    try {
      await warehousesApi.update(editWh.id, form);
      showToast('Warehouse updated', 'success');
      setEditWh(null);
      refetch();
      detail.reload();
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (wh) => {
    if (!window.confirm(`Delete warehouse "${wh.name}" and all linked stock?`)) return;
    try {
      await warehousesApi.remove(wh.id);
      showToast('Warehouse deleted', 'success');
      if (selectedId === wh.id) closeDetail();
      selection.clearSelection();
      refetch();
      reloadUsage();
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to delete');
    }
  };

  const handleExportAll = () => {
    if (!filtered.length) {
      showToast('No warehouses to export');
      return;
    }
    const ok = exportWarehousesCsv(filtered, {
      filename: `warehouses-all-${filtered.length}.csv`
    });
    if (ok) showToast(`Exported ${filtered.length} warehouse(s)`, 'success');
  };

  const handleExportSelected = () => {
    if (!selection.count) {
      showToast('Select warehouses to export');
      return;
    }
    const ok = exportWarehousesCsv(selection.selectedRows, {
      filename: `warehouses-selected-${selection.count}.csv`
    });
    if (ok) showToast(`Exported ${selection.count} selected warehouse(s)`, 'success');
  };

  const handleBulkDelete = async () => {
    if (!selection.count || !canManageWarehouses) return;
    const rows = selection.selectedRows;
    const msg =
      rows.length === 1
        ? `Delete warehouse "${rows[0].name}" and all linked stock?`
        : `Delete ${rows.length} selected warehouses and all linked stock? This cannot be undone.`;
    if (!window.confirm(msg)) return;

    setDeleting(true);
    let okCount = 0;
    let failCount = 0;
    for (const wh of rows) {
      try {
        await warehousesApi.remove(wh.id);
        okCount += 1;
        if (selectedId === wh.id) closeDetail();
      } catch {
        failCount += 1;
      }
    }
    setDeleting(false);
    selection.clearSelection();
    if (okCount) {
      showToast(
        okCount === 1 ? 'Warehouse deleted' : `${okCount} warehouses deleted`,
        'success'
      );
      refetch();
      reloadUsage();
      emitInventoryChanged();
    }
    if (failCount) showToast(`${failCount} delete(s) failed`);
  };

  const startTransfer = (from, items = []) => {
    setTransferCtx({ from, items });
    setTransferOpen(true);
  };

  useEffect(() => {
    if (!receiveForStoreId || !warehouses.length) return;
    setPreferredStoreId(receiveForStoreId);
    setSelectedId(warehouses[0].id);
    setDetailOpen(true);
    showToast('Select items in the warehouse, then transfer to your store', 'success');
    setSearchParams({}, { replace: true });
  }, [receiveForStoreId, warehouses, setSearchParams, showToast]);

  const confirmTransfer = async ({ toDestinationId, destinationType, notes, items, itemIds }) => {
    setSaving(true);
    try {
      const lines = (items || []).map((i) => ({
        itemId: String(i.itemId || i.id || i._id || ''),
        qty: i.qty
      })).filter((i) => i.itemId);
      const res = await warehousesApi.transfer({
        fromWarehouseId: transferCtx.from.id,
        toDestinationId,
        destinationType,
        items: lines,
        itemIds: itemIds?.length ? itemIds : lines.map((i) => i.itemId),
        notes
      });
      showToast(res.data?.message || 'Transfer completed successfully!', 'success');
      setTransferTick((t) => t + 1);
      setPreferredStoreId('');
      refetch();
      refetchStores();
      detail.reload();
      emitInventoryChanged();
      return res.data?.message;
    } catch (e) {
      showToast(e.response?.data?.message || 'Transfer failed');
      throw e;
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      className="app-shell--warehouses"
      searchPlaceholder={t('Search warehouses, items, locations…')}
      breadcrumbs={BREADCRUMBS}
      navbarRight={
        canManageWarehouses ? (
          <button
            type="button"
            className="btn-add-warehouse-nav"
            onClick={openAddWarehouse}
            disabled={atWarehouseLimit}
            title={
              atWarehouseLimit
                ? t('Warehouse limit reached — upgrade or remove a warehouse to add another')
                : t('Add Warehouse')
            }
            aria-label={t('Add Warehouse')}
          >
            <i className="fas fa-plus" />
            <span className="wh-chrome-label">{t('Add Warehouse')}</span>
          </button>
        ) : null
      }
    >
      <div className="content wh-list-page">
        <div className="page-header wh-list-desktop-header">
          <div className="wh-list-title-block">
            <h1>{t('Warehouses')}</h1>
            <p className="page-header-sub">{subtitle}</p>
          </div>
          <div className="page-header-actions">
            <button
              type="button"
              className="btn-wh-export"
              onClick={handleExportAll}
              title={t('Export All Warehouses')}
              aria-label={t('Export All Warehouses')}
            >
              <i className="fas fa-file-excel" />
              <span className="wh-chrome-label">{t('Export All Warehouses')}</span>
            </button>
          </div>
        </div>

        <WarehouseLimitBanner />

        <WarehouseWorkerNotice />
        <AccountantReadOnlyNotice module="warehouses" />

        {selection.count > 0 && (
          <div className="wh-list-bulk-bar">
            <span className="wh-list-bulk-count">{t('{count} selected', { count: selection.count })}</span>
            <button type="button" className="btn-wh-bulk" onClick={handleExportSelected}>
              <i className="fas fa-download" /> {t('Export Selected')}
            </button>
            {canManageWarehouses && (
              <button
                type="button"
                className="btn-wh-bulk danger"
                onClick={handleBulkDelete}
                disabled={deleting}
              >
                <i className="fas fa-trash" /> {t('Delete Selected')}
              </button>
            )}
            <button type="button" className="btn-wh-bulk-clear" onClick={selection.clearSelection}>
              {t('Clear')}
            </button>
          </div>
        )}

        {loading && <p style={{ color: 'var(--text-light)' }}><i className="fas fa-spinner fa-spin" /> {t('Loading warehouses…')}</p>}
        {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
        {!loading && !error && (
          <WarehouseGrid
            warehouses={filtered}
            totalCount={warehouses.length}
            searchActive={Boolean(search?.trim())}
            selectedId={detailOpen ? selectedId : null}
            selection={selection}
            toolbarRight={(
              <button
                type="button"
                className="btn-wh-export wh-list-mobile-export"
                onClick={handleExportAll}
                title={t('Export All Warehouses')}
                aria-label={t('Export All Warehouses')}
              >
                <i className="fas fa-file-excel" />
                <span className="wh-chrome-label">{t('Export All Warehouses')}</span>
              </button>
            )}
            onOpen={openDetail}
            onEdit={canManageWarehouses ? (wh) => setEditWh(wh) : undefined}
            onDelete={canManageWarehouses ? handleDelete : undefined}
          />
        )}
      </div>

      <WarehouseDetailPanel
        open={detailOpen}
        warehouseId={selectedId}
        allWarehouses={warehouses}
        detail={detail}
        category={detailCategory}
        stockSearch={detailSearch}
        onCategoryChange={setDetailCategory}
        onStockSearchChange={setDetailSearch}
        page={detailPage}
        pageSize={detailPageSize}
        onPage={setDetailPage}
        onPageSize={(size) => {
          setDetailPageSize(size);
          setDetailPage(1);
        }}
        onClose={closeDetail}
        onSaveChanges={() => showToast('Changes saved', 'success')}
        onTransfer={startTransfer}
        onRefresh={refetch}
        transferTick={transferTick}
        warehousesApi={warehousesApi}
        showToast={showToast}
        readOnly={!canManageInventory}
      />

      <AddEditWarehouseModal open={addOpen} onClose={() => setAddOpen(false)} onSave={handleAdd} saving={saving} />
      <AddEditWarehouseModal open={Boolean(editWh)} warehouse={editWh} onClose={() => setEditWh(null)} onSave={handleEdit} saving={saving} />

      <TransferModal
        open={transferOpen}
        fromWarehouse={transferCtx.from}
        selectedItems={transferCtx.items}
        allWarehouses={warehouses}
        allStores={allStores}
        activeShipments={activeShipments}
        defaultDestType={preferredStoreId ? 'store' : 'warehouse'}
        defaultDestId={preferredStoreId}
        onClose={() => setTransferOpen(false)}
        onConfirm={confirmTransfer}
        saving={saving}
      />
    </AppShell>
  );
}
