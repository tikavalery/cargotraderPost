import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../../layout/AppShell';
import PosNavbar from '../../components/stores/PosNavbar';
import StoreInventoryPanel from '../../components/stores/StoreInventoryPanel';
import TransferModal from '../../components/warehouses/TransferModal';
import ViewItemModal from '../../components/inventory/modals/ViewItemModal';
import { usePosStore } from '../../context/PosStoreContext';
import { useToast } from '../../context/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useShipments } from '../../hooks/useShipments';
import { warehousesApi } from '../../api';
import { storesApi } from '../../services/posApi';
import { emitInventoryChanged } from '../../utils/inventoryEvents';
import ClerkStoreNotice from '../../components/ClerkStoreNotice';
import AccountantReadOnlyNotice from '../../components/AccountantReadOnlyNotice';

export default function StoreInventoryPage() {
  const { storeId } = usePosStore();
  const { showToast } = useToast();
  const { canManageSales, canManageInventory, isOperationsReadOnly } = usePermissions();
  const canTransfer = canManageSales || canManageInventory;
  const canDelete = canManageInventory && !isOperationsReadOnly;

  const [viewItemId, setViewItemId] = useState(null);
  const [viewItemPreview, setViewItemPreview] = useState(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferCtx, setTransferCtx] = useState({ store: null, items: [] });
  const [transferTick, setTransferTick] = useState(0);
  const [transferSaving, setTransferSaving] = useState(false);
  const [allWarehouses, setAllWarehouses] = useState([]);
  const [allStores, setAllStores] = useState([]);

  const { shipments: activeShipments } = useShipments({ mode: 'active', limit: 100 });

  const loadWarehouses = useCallback(() => {
    storesApi
      .transferWarehouses()
      .then((res) => setAllWarehouses(res.data?.warehouses || []))
      .catch(() => setAllWarehouses([]));
  }, []);

  const loadTransferStores = useCallback((excludeStoreId) => {
    const params = excludeStoreId ? { exclude: excludeStoreId } : undefined;
    storesApi
      .transferStores(params)
      .then((res) => setAllStores(res.data?.stores || []))
      .catch(() => setAllStores([]));
  }, []);

  useEffect(() => {
    loadWarehouses();
  }, [loadWarehouses]);

  useEffect(() => {
    if (transferOpen && transferCtx.store?.storeId) {
      loadTransferStores(transferCtx.store.storeId);
    }
  }, [transferOpen, transferCtx.store?.storeId, loadTransferStores]);

  const openView = (item) => {
    if (!item?._id && !item?.id) return;
    setViewItemId(item._id || item.id);
    setViewItemPreview(item);
  };

  const openTransfer = (store, items) => {
    if (!canTransfer) return;
    setTransferCtx({ store, items });
    setTransferOpen(true);
  };

  const confirmTransfer = async ({ toDestinationId, destinationType, notes, items, itemIds }) => {
    setTransferSaving(true);
    try {
      const lines = (items || []).map((i) => ({
        itemId: String(i.itemId || i.id || i._id || ''),
        qty: i.qty
      })).filter((i) => i.itemId);
      const res = await warehousesApi.transfer({
        sourceType: 'store',
        fromStoreId: transferCtx.store.storeId,
        toDestinationId,
        destinationType,
        items: lines,
        itemIds: itemIds?.length ? itemIds : lines.map((i) => i.itemId),
        notes
      });
      showToast(res.data?.message || 'Transfer completed successfully!', 'success');
      setTransferTick((t) => t + 1);
      loadWarehouses();
      if (transferCtx.store?.storeId) loadTransferStores(transferCtx.store.storeId);
      emitInventoryChanged();
      return res.data?.message;
    } catch (e) {
      showToast(e.response?.data?.message || 'Transfer failed');
      throw e;
    } finally {
      setTransferSaving(false);
    }
  };

  const transferSource = useMemo(() => {
    if (!transferCtx.store) return null;
    return {
      type: 'store',
      storeId: transferCtx.store.storeId,
      id: transferCtx.store.storeId,
      name: transferCtx.store.name,
      flag: transferCtx.store.flag,
      icon: transferCtx.store.icon
    };
  }, [transferCtx.store]);

  return (
    <>
      <AppShell
        className="app-shell--store-inventory"
        hideSearch
        breadcrumbs={[
          { label: 'Stores', to: '/stores' },
          { label: 'Store Inventory', current: true }
        ]}
        navbarRight={
          <div className="header-actions store-inventory-nav">
            <PosNavbar />
            <Link to="/stores/pos" className="pos-back-link" title="Open POS" aria-label="Open POS">
              <i className="fas fa-cash-register" />
              <span className="store-inv-chrome-label">Open POS</span>
            </Link>
            <Link to="/stores" className="pos-back-link" title="All Stores" aria-label="All Stores">
              <i className="fas fa-store" />
              <span className="store-inv-chrome-label">All Stores</span>
            </Link>
          </div>
        }
      >
        <div className="content store-inventory-page">
          <ClerkStoreNotice />
          <AccountantReadOnlyNotice module="stores" />

          <StoreInventoryPanel
            storeId={storeId}
            onViewItem={openView}
            onTransfer={openTransfer}
            canTransfer={canTransfer}
            canDelete={canDelete}
            transferTick={transferTick}
          />
        </div>
      </AppShell>

      {canTransfer && (
        <TransferModal
          open={transferOpen}
          fromSource={transferSource}
          selectedItems={transferCtx.items}
          allWarehouses={allWarehouses}
          allStores={allStores}
          activeShipments={activeShipments}
          defaultDestType="warehouse"
          onClose={() => setTransferOpen(false)}
          onConfirm={confirmTransfer}
          saving={transferSaving}
        />
      )}

      <ViewItemModal
        open={Boolean(viewItemId)}
        itemId={viewItemId}
        previewItem={viewItemPreview}
        onClose={() => {
          setViewItemId(null);
          setViewItemPreview(null);
        }}
        stack
      />
    </>
  );
}
