import { useEffect, useState } from 'react';
import AppShell from '../../layout/AppShell';
import AccountantReadOnlyNotice from '../../components/AccountantReadOnlyNotice';
import SuppliersTable from '../../components/purchasing/SuppliersTable';
import AddEditSupplierModal from '../../components/purchasing/AddEditSupplierModal';
import SupplierDetailModal from '../../components/purchasing/SupplierDetailModal';
import TablePagination from '../../components/common/TablePagination';
import { useSuppliers } from '../../hooks/useSuppliers';
import { useSupplierSelection } from '../../hooks/useSupplierSelection';
import { useSyncedSearch } from '../../context/SearchContext';
import { useToast } from '../../context/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
import { suppliersApi } from '../../api';
import { exportSuppliersCsv, printSuppliersReport } from '../../utils/supplierExport';

const BREADCRUMBS = [
  { label: 'CargoTrader', to: '/dashboard' },
  { label: 'Purchases', to: '/purchasing/all' },
  { label: 'Suppliers', current: true }
];

export default function SuppliersPage() {
  const { search } = useSyncedSearch();
  const { showToast } = useToast();
  const { canManagePurchases, isOperationsReadOnly } = usePermissions();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [searchDebounced, setSearchDebounced] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [searchDebounced]);

  const { suppliers, pagination, loading, error, refresh } = useSuppliers({
    paginated: true,
    page,
    limit: pageSize,
    search: searchDebounced
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState(null);
  const [detailSupplier, setDetailSupplier] = useState(null);
  const [detailPurchases, setDetailPurchases] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const selection = useSupplierSelection(suppliers);
  const canManage = canManagePurchases && !isOperationsReadOnly;

  const openDetail = async (supplier) => {
    setDetailSupplier(supplier);
    setDetailPurchases([]);
    setDetailLoading(true);
    try {
      const res = await suppliersApi.get(supplier.supplierId || supplier._id);
      setDetailSupplier(res.data.data || supplier);
      setDetailPurchases(res.data.recentPurchases || []);
    } catch {
      setDetailPurchases([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailSupplier(null);
    setDetailPurchases([]);
  };

  const openAdd = () => {
    setEditSupplier(null);
    setFormOpen(true);
  };

  const openEdit = (supplier) => {
    closeDetail();
    setEditSupplier(supplier);
    setFormOpen(true);
  };

  const handleSave = async (data) => {
    setSaving(true);
    try {
      if (editSupplier) {
        const res = await suppliersApi.update(editSupplier.supplierId || editSupplier._id, data);
        showToast(`Supplier updated: ${res.data.data.name}`, 'success');
      } else {
        const res = await suppliersApi.create(data);
        showToast(`Supplier added: ${res.data.data.name}`, 'success');
      }
      setFormOpen(false);
      setEditSupplier(null);
      await refresh();
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to save supplier');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (supplier) => {
    if ((supplier.purchaseCount ?? 0) > 0) {
      showToast('Cannot delete a supplier with linked purchases');
      return;
    }
    if (!window.confirm(`Delete supplier "${supplier.name}"?`)) return;
    try {
      await suppliersApi.remove(supplier.supplierId || supplier._id);
      showToast('Supplier deleted', 'success');
      closeDetail();
      selection.clearSelection();
      await refresh();
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to delete supplier');
    }
  };

  const handleExportAll = () => {
    if (!suppliers.length) {
      showToast('No suppliers to export');
      return;
    }
    const ok = exportSuppliersCsv(suppliers, {
      filename: `suppliers-page-${suppliers.length}.csv`
    });
    if (ok) showToast(`Exported ${suppliers.length} supplier(s)`, 'success');
  };

  const handlePrintList = () => {
    if (!suppliers.length) {
      showToast('No suppliers to print');
      return;
    }
    const ok = printSuppliersReport(suppliers, { title: 'Supplier List' });
    if (!ok) showToast('Allow pop-ups to print the supplier list');
  };

  const handleExportSelected = () => {
    if (!selection.count) {
      showToast('Select suppliers to export');
      return;
    }
    const ok = exportSuppliersCsv(selection.selectedRows, {
      filename: `suppliers-selected-${selection.count}.csv`
    });
    if (ok) showToast(`Exported ${selection.count} selected supplier(s)`, 'success');
  };

  const handleBulkDelete = async () => {
    if (!selection.count) return;

    const linked = selection.selectedRows.filter((s) => (s.purchaseCount ?? 0) > 0);
    const deletable = selection.selectedRows.filter((s) => (s.purchaseCount ?? 0) === 0);

    if (!deletable.length) {
      showToast('Selected suppliers have linked purchases and cannot be deleted');
      return;
    }

    const msg =
      linked.length > 0
        ? `Delete ${deletable.length} supplier(s)? ${linked.length} with linked purchases will be skipped.`
        : `Delete ${deletable.length} selected supplier(s)?`;

    if (!window.confirm(msg)) return;

    try {
      const ids = deletable.map((s) => s.supplierId || s._id);
      const res = await suppliersApi.bulkDelete(ids);
      selection.clearSelection();
      closeDetail();
      await refresh();
      showToast(res.data?.message || `Deleted ${res.data?.deleted ?? ids.length} supplier(s)`, 'success');
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to delete suppliers');
    }
  };

  return (
    <AppShell
      className="app-shell--suppliers"
      searchPlaceholder="Search suppliers, cities, contacts…"
      breadcrumbs={BREADCRUMBS}
    >
      <div className="content pur-suppliers-page">
        <div className="page-header pur-all-header">
          <div>
            <h1>Suppliers</h1>
            <p className="page-header-sub">
              Manage sourcing partners used on purchase records and inventory items
            </p>
          </div>
          <div className="header-btns">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleExportAll}
              title="Export All Suppliers"
              aria-label="Export All Suppliers"
            >
              <i className="fas fa-file-excel" />
              <span className="pur-chrome-label">Export All Suppliers</span>
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handlePrintList}
              title="Print Supplier List"
              aria-label="Print Supplier List"
            >
              <i className="fas fa-print" />
              <span className="pur-chrome-label">Print Supplier List</span>
            </button>
            {canManagePurchases ? (
              <button
                type="button"
                className="btn-add"
                onClick={openAdd}
                title="Add Supplier"
                aria-label="Add Supplier"
              >
                <i className="fas fa-plus" />
                <span className="pur-chrome-label">Add Supplier</span>
              </button>
            ) : null}
          </div>
        </div>

        <AccountantReadOnlyNotice module="purchases" />

        <SuppliersTable
          suppliers={suppliers}
          loading={loading}
          error={error}
          selection={selection}
          canManage={canManage}
          onView={openDetail}
          onEdit={openEdit}
          onDelete={handleDelete}
          onExportSelected={handleExportSelected}
          onBulkDelete={canManage ? handleBulkDelete : undefined}
        />

        <TablePagination
          page={pagination.page || page}
          pages={pagination.pages || 1}
          total={pagination.total ?? suppliers.length}
          pageSize={pagination.pageSize || pageSize}
          onPage={setPage}
          onPageSize={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          noun="suppliers"
          disabled={loading}
        />
      </div>

      {canManagePurchases && (
        <AddEditSupplierModal
          open={formOpen}
          supplier={editSupplier}
          onClose={() => {
            setFormOpen(false);
            setEditSupplier(null);
          }}
          onSave={handleSave}
          saving={saving}
        />
      )}

      <SupplierDetailModal
        open={Boolean(detailSupplier)}
        supplier={detailSupplier}
        recentPurchases={detailLoading ? [] : detailPurchases}
        onClose={closeDetail}
        onEdit={openEdit}
        onDelete={handleDelete}
        canManage={canManage}
      />
    </AppShell>
  );
}
