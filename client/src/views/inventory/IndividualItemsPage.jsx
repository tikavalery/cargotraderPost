import { useMemo, useState, useCallback, useEffect } from 'react';
import { inventoryItemsApi } from '../../api';
import { useToast } from '../../context/ToastContext';
import { useSyncedSearch } from '../../context/SearchContext';
import { useWarehouseWorker } from '../../context/WarehouseWorkerContext';
import { CATEGORIES } from '../../theme/inventoryConstants';
import { emitInventoryChanged } from '../../utils/inventoryEvents';
import {
  exportInventoryCsv,
  printInventoryLabels,
  printInventoryReport
} from '../../utils/inventoryExport';
import { useInventoryItems, useInventoryMeta, useInventorySelection } from '../../hooks/useInventory';
import AppShell from '../../layout/AppShell';
import ItemsTable from '../../components/inventory/ItemsTable';
import TablePagination from '../../components/common/TablePagination';
import AddEditItemModal from '../../components/inventory/modals/AddEditItemModal';
import ManageGroupsModal from '../../components/inventory/modals/ManageGroupsModal';
import ViewItemModal from '../../components/inventory/modals/ViewItemModal';
import ScanQrModal from '../../components/inventory/modals/ScanQrModal';
import ViewQrModal from '../../components/inventory/modals/ViewQrModal';
import { useInventoryQr } from '../../hooks/useInventoryQr';
import { useInventoryScanHandlers } from '../../hooks/useInventoryScanHandlers';
import { filterItemsForScan } from '../../utils/scanFilter';
import { usePermissions } from '../../hooks/usePermissions';
import ClerkStoreNotice from '../../components/ClerkStoreNotice';
import WarehouseWorkerNotice from '../../components/WarehouseWorkerNotice';
import AccountantReadOnlyNotice from '../../components/AccountantReadOnlyNotice';
import InventoryLimitBanner from '../../components/plan/InventoryLimitBanner';

export default function IndividualItemsPage() {
  const { inventoryReadOnly, canViewCost } = usePermissions();
  const warehouseCtx = useWarehouseWorker();
  const activeWarehouseId =
    warehouseCtx?.isWarehouseWorker && warehouseCtx?.warehouseId ? warehouseCtx.warehouseId : '';
  const { search, setSearch } = useSyncedSearch();
  const { showToast } = useToast();
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [group, setGroup] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const resetFilters = useCallback(() => {
    setSearch('');
    setCategory('');
    setLocation('');
    setGroup('');
    setPage(1);
  }, [setSearch]);

  const {
    scanOpen,
    setScanOpen,
    lookupLoading,
    handleScanCode,
    scanMatch,
    scanFilterActive,
    scanFilterLabel,
    clearScanFilter
  } = useInventoryScanHandlers({ resetFilters });

  const filters = useMemo(
    () =>
      scanMatch
        ? { search: '', category: '', location: '', group: '', warehouseId: activeWarehouseId, page, pageSize }
        : { search, category, location, group, warehouseId: activeWarehouseId, page, pageSize },
    [scanMatch, search, category, location, group, activeWarehouseId, page, pageSize]
  );
  const { items, pagination, loading, error, refetch } = useInventoryItems(filters);
  const { locations, suppliers, groups, reloadMeta } = useInventoryMeta();
  const { qrRecord, qrOpen, openQr, closeQr } = useInventoryQr();

  useEffect(() => {
    setPage(1);
  }, [search, category, location, group, activeWarehouseId, scanMatch]);

  const [editOpen, setEditOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [viewItemId, setViewItemId] = useState(null);
  const [viewItemPreview, setViewItemPreview] = useState(null);

  const refreshAll = async () => {
    await refetch();
    await reloadMeta();
  };

  const openView = (item) => {
    if (!item?._id) return;
    setViewItemId(item._id);
    setViewItemPreview(item);
  };

  const closeView = () => {
    setViewItemId(null);
    setViewItemPreview(null);
  };

  const displayItems = useMemo(
    () => filterItemsForScan(items, scanMatch),
    [items, scanMatch]
  );

  const selection = useInventorySelection(displayItems);

  const handleAction = (action, item) => {
    if (action === 'export-all') {
      if (!displayItems.length) {
        showToast('No items to export');
        return;
      }
      const ok = exportInventoryCsv(displayItems, {
        filename: `inventory-all-${displayItems.length}.csv`,
        includeCost: canViewCost
      });
      if (ok) showToast(`Exported ${displayItems.length} item(s)`, 'success');
      return;
    }
    if (action === 'print-report') {
      if (!displayItems.length) {
        showToast('No items to print');
        return;
      }
      const ok = printInventoryReport(displayItems, {
        includeCost: canViewCost,
        title: 'Individual Items Inventory Report'
      });
      if (!ok) showToast('Allow pop-ups to print the inventory report');
      return;
    }
    if (action === 'export-selected') {
      if (!selection.count) {
        showToast('Select items to export');
        return;
      }
      const ok = exportInventoryCsv(selection.selectedItems, {
        filename: `inventory-selected-${selection.count}.csv`,
        includeCost: canViewCost
      });
      if (ok) showToast(`Exported ${selection.count} selected item(s)`, 'success');
      return;
    }
    if (action === 'print-labels') {
      if (!selection.count) {
        showToast('Select items to print labels');
        return;
      }
      printInventoryLabels(selection.selectedItems)
        .then((ok) => {
          if (!ok) showToast('Allow pop-ups to print labels');
        })
        .catch(() => showToast('Could not generate labels'));
      return;
    }

    if (action === 'manage-groups') {
      if (inventoryReadOnly) return;
      setGroupsOpen(true);
      return;
    }
    if (inventoryReadOnly && action !== 'view' && action !== 'bulk-view') return;
    if (action === 'view' && item) {
      openView(item);
      return;
    }
    if (action === 'bulk-view') {
      if (selection.count !== 1) {
        showToast('Select exactly one item to view');
        return;
      }
      openView(selection.selectedItems[0]);
      return;
    }
    if (action === 'bulk-edit') {
      if (selection.count !== 1) {
        showToast('Select exactly one item to edit');
        return;
      }
      setEditItem(selection.selectedItems[0]);
      setEditOpen(true);
      return;
    }
    if (action === 'bulk-delete') {
      if (!window.confirm(`Delete ${selection.count} selected item(s)? This cannot be undone.`)) return;
      inventoryItemsApi
        .bulkDelete([...selection.selected])
        .then(() => {
          showToast('Items deleted', 'success');
          selection.clear();
          refreshAll();
        })
        .catch((err) => showToast(err.response?.data?.message || 'Delete failed'));
    }
  };

  const handleSave = async (data) => {
    if (!editItem?._id) return;
    try {
      await inventoryItemsApi.update(editItem._id, data);
      showToast('Item updated', 'success');
      setEditItem(null);
      setEditOpen(false);
      selection.clear();
      emitInventoryChanged();
      await refreshAll();
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed');
      throw err;
    }
  };

  return (
    <AppShell searchPlaceholder="Search items, SKU…">
      <div className="content inv-scroll-layout inv-items-page">
        <ClerkStoreNotice />
        <WarehouseWorkerNotice />
        <AccountantReadOnlyNotice module="inventory" />
        <InventoryLimitBanner />
        {error && (
          <div
            className="inv-fetch-error"
            style={{
              margin: '0 0 16px',
              padding: '12px 16px',
              borderRadius: 8,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: 14
            }}
          >
            <strong>Could not load items.</strong> {error}
            <button
              type="button"
              className="btn-secondary"
              style={{ marginLeft: 12 }}
              onClick={() => refetch()}
            >
              Retry
            </button>
          </div>
        )}
        <ItemsTable
          items={displayItems}
          loading={loading}
          selection={selection}
          onRowClick={handleAction}
          category={category}
          location={location}
          group={group}
          categories={CATEGORIES}
          locations={locations}
          groups={groups}
          onCategory={setCategory}
          onLocation={setLocation}
          onGroup={setGroup}
          onScan={() => setScanOpen(true)}
          onShowQr={openQr}
          error={error}
          scanFilterLabel={scanFilterActive ? scanFilterLabel : ''}
          onClearScanFilter={clearScanFilter}
        />
        <TablePagination
          page={pagination.page || page}
          pages={pagination.pages || 1}
          total={pagination.total ?? displayItems.length}
          pageSize={pagination.pageSize || pageSize}
          onPage={setPage}
          onPageSize={(size) => { setPageSize(size); setPage(1); }}
          noun="items"
          disabled={loading}
        />

        {!inventoryReadOnly && (
          <>
            <AddEditItemModal
              open={editOpen && !!editItem}
              mode="edit"
              item={editItem}
              locations={locations}
              suppliers={suppliers}
              groups={groups}
              onClose={() => {
                setEditOpen(false);
                setEditItem(null);
              }}
              onSave={handleSave}
              onManageGroups={() => setGroupsOpen(true)}
            />
            <ManageGroupsModal
              open={groupsOpen}
              groups={groups}
              onClose={() => setGroupsOpen(false)}
              onChanged={refreshAll}
            />
          </>
        )}

        <ViewItemModal
          open={!!viewItemId}
          itemId={viewItemId}
          previewItem={viewItemPreview}
          suppliers={suppliers}
          onClose={closeView}
          onShowQr={openQr}
        />

        <ViewQrModal open={qrOpen} record={qrRecord} onClose={closeQr} />

        <ScanQrModal
          open={scanOpen}
          onClose={() => setScanOpen(false)}
          onScan={handleScanCode}
          loading={lookupLoading}
        />
      </div>
    </AppShell>
  );
}
