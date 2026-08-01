import { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AppShell from '../../layout/AppShell';
import AccountantReadOnlyNotice from '../../components/AccountantReadOnlyNotice';
import PurchasesTable from '../../components/purchasing/PurchasesTable';
import PurchaseViewModal from '../../components/purchasing/PurchaseViewModal';
import TablePagination from '../../components/common/TablePagination';
import { usePurchases } from '../../hooks/usePurchases';
import { useSuppliers } from '../../hooks/useSuppliers';
import { usePurchaseSelection } from '../../hooks/usePurchaseSelection';
import { useSyncedSearch } from '../../context/SearchContext';
import { useToast } from '../../context/ToastContext';
import { usePermissions } from '../../hooks/usePermissions';
import { filterPurchases } from '../../utils/normalizePurchase';
import {
  exportPurchasesCsv,
  printPurchasesReport,
  printSelectedPurchases
} from '../../utils/purchaseExport';

const BREADCRUMBS = [
  { label: 'CargoTrader', to: '/dashboard' },
  { label: 'Purchases', to: '/purchasing/all' },
  { label: 'All Purchases', current: true }
];

export default function AllPurchasesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const supplierFilter = searchParams.get('supplier') || '';
  const { showToast } = useToast();
  const { canManagePurchases, isOperationsReadOnly } = usePermissions();
  const { search } = useSyncedSearch();
  const { suppliers } = useSuppliers();
  const activeSupplier = suppliers.find((s) => s.supplierId === supplierFilter);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { purchases, loading, error, bulkDelete, pagination } = usePurchases({
    supplierId: supplierFilter || undefined,
    page,
    limit: pageSize
  });
  const [viewId, setViewId] = useState(null);
  const [viewPreview, setViewPreview] = useState(null);

  useEffect(() => {
    setPage(1);
  }, [supplierFilter, search]);

  const filtered = useMemo(() => filterPurchases(purchases, search), [purchases, search]);
  const selection = usePurchaseSelection(filtered);

  const openView = (purchase) => {
    setViewPreview(purchase);
    setViewId(purchase.selectId || purchase.id);
  };

  const handleExportAll = () => {
    if (!filtered.length) {
      showToast('No purchases to export');
      return;
    }
    const ok = exportPurchasesCsv(filtered, {
      filename: `purchases-all-${filtered.length}.csv`
    });
    if (ok) showToast(`Exported ${filtered.length} purchase(s)`, 'success');
  };

  const handlePrintReport = () => {
    if (!filtered.length) {
      showToast('No purchases to print');
      return;
    }
    const ok = printPurchasesReport(filtered, { title: 'Purchase Report' });
    if (!ok) showToast('Allow pop-ups to print the purchase report');
  };

  const handleExportSelected = () => {
    if (!selection.count) {
      showToast('Select purchases to export');
      return;
    }
    const ok = exportPurchasesCsv(selection.selectedRows, {
      filename: `purchases-selected-${selection.count}.csv`
    });
    if (ok) showToast(`Exported ${selection.count} selected purchase(s)`, 'success');
  };

  const handlePrintSelected = () => {
    if (!selection.count) {
      showToast('Select purchases to print');
      return;
    }
    const ok = printSelectedPurchases(selection.selectedRows);
    if (!ok) showToast('Allow pop-ups to print selected purchases');
  };

  const handleBulkEdit = () => {
    if (selection.count !== 1) {
      showToast('Select exactly one purchase to edit');
      return;
    }
    const id = selection.firstSelectedId();
    if (id) navigate(`/purchasing/new?edit=${encodeURIComponent(id)}`);
  };

  const handleBulkDelete = async () => {
    const ids = [...selection.selectedIds];
    if (!ids.length) return;

    const names = selection.selectedRows.map((r) => r.itemName).filter(Boolean);
    const msg =
      ids.length === 1 && names[0]
        ? `Delete purchase "${names[0]}"?`
        : `Delete ${ids.length} selected purchase record(s)?`;

    if (!window.confirm(msg)) return;

    try {
      const deleted = await bulkDelete(ids);
      selection.clearSelection();
      showToast(
        deleted === 1 ? 'Purchase deleted' : `${deleted} purchase(s) deleted`,
        'success'
      );
    } catch (e) {
      showToast(e.response?.data?.message || 'Failed to delete purchases');
    }
  };

  const closeView = () => {
    setViewId(null);
    setViewPreview(null);
  };

  const clearSupplierFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('supplier');
    setSearchParams(next, { replace: true });
  };

  return (
    <AppShell
      className="app-shell--all-purchases"
      searchPlaceholder="Search purchases, items, SKU…"
      breadcrumbs={BREADCRUMBS}
    >
      <div className="content pur-all-page">
        <div className="page-header pur-all-header">
          <div>
            <h1>All Purchases</h1>
            <p className="page-sub">Full purchase records with all inventory form fields</p>
          </div>
          <div className="header-btns">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleExportAll}
              title="Export All Purchases"
              aria-label="Export All Purchases"
            >
              <i className="fas fa-file-excel" />
              <span className="pur-chrome-label">Export All Purchases</span>
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handlePrintReport}
              title="Print Purchase Report"
              aria-label="Print Purchase Report"
            >
              <i className="fas fa-print" />
              <span className="pur-chrome-label">Print Purchase Report</span>
            </button>
            <Link
              to="/purchasing/suppliers"
              className="btn-secondary"
              title="Suppliers"
              aria-label="Suppliers"
            >
              <i className="fas fa-address-book" />
              <span className="pur-chrome-label">Suppliers</span>
            </Link>
            {canManagePurchases ? (
              <Link
                to="/purchasing/new"
                className="btn-add"
                title="New Purchase"
                aria-label="New Purchase"
              >
                <i className="fas fa-plus" />
                <span className="pur-chrome-label">New Purchase</span>
              </Link>
            ) : null}
          </div>
        </div>

        <AccountantReadOnlyNotice module="purchases" />

        {activeSupplier && (
          <div className="sup-filter-banner">
            <span>
              <i className="fas fa-filter" /> Showing purchases from{' '}
              <strong>{activeSupplier.name}</strong>
            </span>
            <button type="button" className="link-btn" onClick={clearSupplierFilter}>
              Clear filter
            </button>
          </div>
        )}

        <PurchasesTable
          rows={filtered}
          loading={loading}
          error={error}
          selection={selection}
          onRowClick={openView}
          onExportSelected={handleExportSelected}
          onPrintSelected={handlePrintSelected}
          onBulkEdit={canManagePurchases ? handleBulkEdit : undefined}
          onBulkDelete={canManagePurchases ? handleBulkDelete : undefined}
          readOnly={isOperationsReadOnly}
        />
        <TablePagination
          page={pagination.page || page}
          pages={pagination.pages || 1}
          total={pagination.total ?? filtered.length}
          pageSize={pagination.pageSize || pageSize}
          onPage={setPage}
          onPageSize={(size) => { setPageSize(size); setPage(1); }}
          noun="purchases"
          disabled={loading}
        />
      </div>

      <PurchaseViewModal
        open={Boolean(viewId)}
        purchaseId={viewId}
        preview={viewPreview}
        onClose={closeView}
      />
    </AppShell>
  );
}
