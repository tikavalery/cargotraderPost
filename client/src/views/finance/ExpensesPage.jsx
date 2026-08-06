import { useEffect, useMemo, useRef, useState } from 'react';
import FinanceLayout from '../../components/finance/FinanceLayout';
import KpiCard from '../../components/finance/KpiCard';
import { ExportButtons, RangePills } from '../../components/finance/FinanceNavbar';
import FinanceTableActions, { canModifyFinanceEntry } from '../../components/finance/FinanceTableActions';
import { RecordExpenseModal } from '../../components/finance/RecordModals';
import Td from '../../components/common/Td';
import MobileSelectAllBar from '../../components/common/MobileSelectAllBar';
import TablePagination from '../../components/common/TablePagination';
import { useFinanceFilters } from '../../context/FinanceFilterContext';
import { financeApi } from '../../services/financeApi';
import { useToast } from '../../context/ToastContext';
import { usePurchaseSelection } from '../../hooks/usePurchaseSelection';
import { useT } from '../../i18n/LanguageContext';
import { fmtCurrency } from '../../constants/financeConstants';
import {
  exportExpensesCsv,
  printExpensesReport,
  printSelectedExpenses
} from '../../utils/expenseExport';
import { mediaSrc } from '../../utils/cloudinaryUpload';

const EXPENSE_SORT_OPTIONS = [
  { value: 'date-desc', label: 'Date (newest first)', field: 'date', dir: 'desc' },
  { value: 'date-asc', label: 'Date (oldest first)', field: 'date', dir: 'asc' },
  { value: 'amount-desc', label: 'Amount (high to low)', field: 'amount', dir: 'desc' },
  { value: 'amount-asc', label: 'Amount (low to high)', field: 'amount', dir: 'asc' },
  { value: 'category-asc', label: 'Category (A–Z)', field: 'category', dir: 'asc' },
  { value: 'category-desc', label: 'Category (Z–A)', field: 'category', dir: 'desc' },
  { value: 'description-asc', label: 'Description (A–Z)', field: 'description', dir: 'asc' },
  { value: 'description-desc', label: 'Description (Z–A)', field: 'description', dir: 'desc' },
  { value: 'related-asc', label: 'Related (A–Z)', field: 'related', dir: 'asc' },
  { value: 'related-desc', label: 'Related (Z–A)', field: 'related', dir: 'desc' },
  { value: 'status-asc', label: 'Status (Recorded first)', field: 'status', dir: 'asc' },
  { value: 'status-desc', label: 'Status (Synced first)', field: 'status', dir: 'desc' },
  { value: 'source-asc', label: 'Source (A–Z)', field: 'source', dir: 'asc' },
  { value: 'source-desc', label: 'Source (Z–A)', field: 'source', dir: 'desc' }
];

function formatExpenseDate(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  try {
    return d.toISOString().slice(0, 10);
  } catch {
    return '—';
  }
}

function expenseSortValue(row, field) {
  switch (field) {
    case 'date': {
      const ts = row.date ? new Date(row.date).getTime() : 0;
      return Number.isFinite(ts) ? ts : 0;
    }
    case 'amount':
      return Number(row.amountXaf) || Number(row.amount) || 0;
    case 'category':
      return String(row.category || '').toLowerCase();
    case 'description':
      return String(row.description || '').toLowerCase();
    case 'related':
      return String(row.relatedTo || row.reference || row.shipmentId || '').toLowerCase();
    case 'status':
      return row.auto ? 1 : 0;
    case 'source':
      return String(row.source || '').toLowerCase();
    default:
      return '';
  }
}

function sortExpenseRows(rows, sortValue) {
  const opt = EXPENSE_SORT_OPTIONS.find((o) => o.value === sortValue) || EXPENSE_SORT_OPTIONS[0];
  const mult = opt.dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = expenseSortValue(a, opt.field);
    const bv = expenseSortValue(b, opt.field);
    if (typeof av === 'number' && typeof bv === 'number') {
      if (av === bv) return String(a.id).localeCompare(String(b.id));
      return (av - bv) * mult;
    }
    const cmp = String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' });
    if (cmp === 0) return String(a.id).localeCompare(String(b.id));
    return cmp * mult;
  });
}

export default function ExpensesPage() {
  const t = useT();
  const { range, setRange } = useFinanceFilters();
  const { showToast } = useToast();
  const rowsRef = useRef([]);

  const handleExport = (fmt) => {
    const rows = rowsRef.current || [];
    if (!rows.length) {
      showToast(t('No expenses to export'));
      return;
    }
    if (fmt === 'excel') {
      const ok = exportExpensesCsv(rows, { filename: `expenses-all-${rows.length}.csv` });
      if (ok) showToast(t('Exported {count} expense entries', { count: rows.length }), 'success');
      return;
    }
    if (fmt === 'pdf') {
      const ok = printExpensesReport(rows, { title: t('Expenses Report') });
      if (!ok) showToast(t('Allow pop-ups to export PDF'));
      else showToast(t('Print dialog opened — save as PDF'), 'success');
    }
  };

  return (
    <FinanceLayout
      breadcrumbs={[{ label: 'CargoTrader', to: '/dashboard' }, { label: 'Finance', to: '/finance' }, { label: 'Expenses', current: true }]}
      title={<><i className="fas fa-receipt" /> {t('Expenses')}</>}
      subtitle={t('All Categories · This Month')}
      hideGlobalFilters
      showSearch
      headerRight={({ openRecordExpense }) => (
        <div className="fin-dashboard-actions">
          <button
            type="button"
            className="btn-record-expense"
            onClick={openRecordExpense}
            title={t('Record Expense')}
            aria-label={t('Record Expense')}
          >
            <i className="fas fa-minus-circle" />
            <span className="fin-chrome-label">{t('Record Expense')}</span>
          </button>
          <RangePills value={range} onChange={setRange} />
          <ExportButtons onExport={handleExport} />
        </div>
      )}
    >
      {({ tick, refresh }) => (
        <ExpensesBody range={range} tick={tick} refresh={refresh} rowsRef={rowsRef} />
      )}
    </FinanceLayout>
  );
}

function SortableTh({ label, field, sortValue, onSort }) {
  const t = useT();
  const active = sortValue.startsWith(`${field}-`);
  const dir = sortValue.endsWith('-asc') ? 'asc' : 'desc';
  const next =
    field === 'date' || field === 'amount' || field === 'status'
      ? active && dir === 'desc'
        ? `${field}-asc`
        : `${field}-desc`
      : active && dir === 'asc'
        ? `${field}-desc`
        : `${field}-asc`;

  return (
    <th className={`fin-sortable-th${active ? ' is-active' : ''}`}>
      <button
        type="button"
        className="fin-sortable-btn"
        onClick={() => onSort(next)}
        aria-label={t('Sort by {field}', { field: label })}
      >
        <span>{label}</span>
        <i
          className={`fas ${
            active
              ? dir === 'asc'
                ? 'fa-sort-up'
                : 'fa-sort-down'
              : 'fa-sort'
          }`}
          aria-hidden
        />
      </button>
    </th>
  );
}

function ExpensesBody({ range, tick, refresh, rowsRef }) {
  const t = useT();
  const { currency } = useFinanceFilters();
  const { showToast } = useToast();
  const [summary, setSummary] = useState(null);
  const [list, setList] = useState({ data: [] });
  const [loading, setLoading] = useState(true);
  const [viewRow, setViewRow] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [sortValue, setSortValue] = useState('date-desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const rows = useMemo(() => {
    const mapped = (list.data || []).map((r) => ({ ...r, selectId: r.id }));
    return sortExpenseRows(mapped, sortValue);
  }, [list.data, sortValue]);
  const selection = usePurchaseSelection(rows);
  const pagination = list.pagination || { page: 1, pageSize, total: rows.length, pages: 1 };

  useEffect(() => {
    if (rowsRef) rowsRef.current = rows;
  }, [rows, rowsRef]);

  useEffect(() => {
    selection.clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset selection when filters change
  }, [currency, range, tick, sortValue, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [currency, range, tick]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    financeApi.expensesOverview({ range, currency, page, pageSize })
      .then((res) => {
        if (cancelled) return;
        const payload = res.data?.data;
        if (!payload) {
          setLoadError('Unable to load expenses');
          return;
        }
        setSummary(payload.summary);
        setList(payload.list || { data: [], pagination: { page: 1, pageSize, total: 0, pages: 1 } });
      })
      .catch((err) => {
        if (cancelled) return;
        const offline = !err?.response;
        setLoadError(
          offline
            ? 'Cannot reach the API. Start the server (npm run dev from the project root), then refresh.'
            : err.response?.data?.message || 'Unable to load expenses'
        );
        showToast(offline ? 'API server is not running' : 'Unable to load expenses');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currency, range, tick, page, pageSize, showToast]);

  const handleEdit = (row) => {
    if (!canModifyFinanceEntry(row)) {
      showToast('This entry is auto-synced and cannot be edited here');
      return;
    }
    setEditRow(row);
  };

  const handleDelete = async (row) => {
    if (!canModifyFinanceEntry(row)) {
      showToast('This entry is auto-synced and cannot be deleted');
      return;
    }
    if (!window.confirm('Delete this expense?')) return;
    try {
      await financeApi.deleteExpense(row.id);
      showToast('Expense deleted', 'success');
      selection.clearSelection();
      refresh();
    } catch (e) {
      showToast(e.response?.data?.message || 'Cannot delete auto-synced entry');
    }
  };

  const handleEditSave = async (data) => {
    if (!editRow) return;
    setSaving(true);
    try {
      await financeApi.updateExpense(editRow.id, data);
      showToast('Expense updated', 'success');
      setEditRow(null);
      refresh();
    } catch (e) {
      showToast(e.response?.data?.message || 'Unable to update expense');
    } finally {
      setSaving(false);
    }
  };

  const handleExportAll = () => {
    if (!rows.length) {
      showToast('No expenses to export');
      return;
    }
    const ok = exportExpensesCsv(rows, { filename: `expenses-all-${rows.length}.csv` });
    if (ok) showToast(`Exported ${rows.length} expense entr${rows.length === 1 ? 'y' : 'ies'}`, 'success');
  };

  const handleExportSelected = () => {
    if (!selection.count) {
      showToast('Select expenses to export');
      return;
    }
    const ok = exportExpensesCsv(selection.selectedRows, {
      filename: `expenses-selected-${selection.count}.csv`
    });
    if (ok) showToast(`Exported ${selection.count} selected entr${selection.count === 1 ? 'y' : 'ies'}`, 'success');
  };

  const handlePrintSelected = () => {
    if (!selection.count) {
      showToast('Select expenses to print');
      return;
    }
    const ok = printSelectedExpenses(selection.selectedRows);
    if (!ok) showToast('Allow pop-ups to print selected expenses');
  };

  const handleBulkDelete = async () => {
    if (!selection.count) return;
    const deletable = selection.selectedRows.filter(canModifyFinanceEntry);
    if (!deletable.length) {
      showToast('Selected entries are auto-synced and cannot be deleted');
      return;
    }

    const skipped = selection.count - deletable.length;
    const msg =
      skipped > 0
        ? `Delete ${deletable.length} recorded entr${deletable.length === 1 ? 'y' : 'ies'}? ${skipped} auto-synced entr${skipped === 1 ? 'y' : 'ies'} will be skipped.`
        : deletable.length === 1
          ? 'Delete this expense?'
          : `Delete ${deletable.length} selected expenses?`;

    if (!window.confirm(msg)) return;

    setDeleting(true);
    let okCount = 0;
    let failCount = 0;
    for (const row of deletable) {
      try {
        await financeApi.deleteExpense(row.id);
        okCount += 1;
      } catch {
        failCount += 1;
      }
    }
    setDeleting(false);
    selection.clearSelection();
    if (okCount) {
      showToast(
        okCount === 1 ? 'Expense deleted' : `${okCount} expenses deleted`,
        'success'
      );
      refresh();
    }
    if (failCount) showToast(`${failCount} delete(s) failed`);
  };

  if (loading && !summary) return <div className="fin-empty">Loading…</div>;
  if (!summary) {
    return (
      <div className="fin-empty" role="alert">
        <p>{loadError || 'Unable to load expenses'}</p>
        <button type="button" className="fin-bulk-btn" onClick={refresh} style={{ marginTop: 12 }}>
          <i className="fas fa-sync-alt" /> Retry
        </button>
      </div>
    );
  }

  const {
    selectedIds,
    toggleRow,
    toggleAll,
    visibleIds,
    allVisibleSelected,
    someVisibleSelected,
    clearSelection,
    count
  } = selection;

  return (
    <>
      <div className="kpi-grid kpi-grid-5">
        <KpiCard label="Total Expenses" value={summary.total} accent="red" />
        <KpiCard label="Purchases Cost" value={fmtCurrency(currency, summary.purchasesXaf)} />
        <KpiCard label="Shipping & Logistics" value={fmtCurrency(currency, summary.shippingXaf)} />
        <KpiCard label="Operating Expenses" value={fmtCurrency(currency, summary.operatingXaf)} />
        <KpiCard label="Expense Growth" value="+0%" />
      </div>

      <div className="fin-card" style={{ marginTop: 14 }}>
        <div className="fin-card-header">
          <div className="fin-card-title">{t('Recent Expenses')}</div>
          <div className="fin-card-header-actions">
            <label className="fin-sort-control">
              <span className="fin-sort-label">{t('Sort by')}</span>
              <select
                className="fin-filter-select fin-sort-select"
                value={sortValue}
                onChange={(e) => setSortValue(e.target.value)}
                aria-label={t('Sort expenses')}
              >
                {EXPENSE_SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.label)}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="fin-export-all-btn" onClick={handleExportAll}>
              <i className="fas fa-file-excel" /> {t('Export All Expenses')}
            </button>
          </div>
        </div>

        {count > 0 && (
          <div className="fin-selection-bar">
            <span className="fin-bulk-count">{count} selected</span>
            <button type="button" className="fin-bulk-btn" onClick={handleExportSelected}>
              <i className="fas fa-download" /> Export Selected
            </button>
            <button type="button" className="fin-bulk-btn" onClick={handlePrintSelected}>
              <i className="fas fa-print" /> Print Selected
            </button>
            <button
              type="button"
              className="fin-bulk-btn fin-bulk-delete"
              onClick={handleBulkDelete}
              disabled={deleting}
            >
              <i className="fas fa-trash" /> Delete Selected
            </button>
            <button type="button" className="fin-bulk-clear" onClick={clearSelection}>
              Clear
            </button>
          </div>
        )}

        <div className="fin-table-wrap">
          <MobileSelectAllBar
            checked={allVisibleSelected && rows.length > 0}
            indeterminate={someVisibleSelected}
            onChange={() => toggleAll(visibleIds)}
            disabled={!rows.length}
            countLabel={rows.length ? `${rows.length} entr${rows.length !== 1 ? 'ies' : 'y'}` : ''}
          />
          <table className="fin-table at-responsive-table">
            <thead>
              <tr>
                <th className="fin-check-col">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected && rows.length > 0}
                    ref={(el) => { if (el) el.indeterminate = someVisibleSelected; }}
                    onChange={() => toggleAll(visibleIds)}
                    aria-label="Select all"
                    disabled={!rows.length}
                  />
                </th>
                <SortableTh label={t('Date')} field="date" sortValue={sortValue} onSort={setSortValue} />
                <SortableTh label={t('Category')} field="category" sortValue={sortValue} onSort={setSortValue} />
                <SortableTh label={t('Description')} field="description" sortValue={sortValue} onSort={setSortValue} />
                <SortableTh label={t('Amount')} field="amount" sortValue={sortValue} onSort={setSortValue} />
                <th>{t('Receipts')}</th>
                <SortableTh label={t('Related')} field="related" sortValue={sortValue} onSort={setSortValue} />
                <SortableTh label={t('Status')} field="status" sortValue={sortValue} onSort={setSortValue} />
                <th>{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length ? rows.map((r) => {
                const selected = selectedIds.has(r.id);
                return (
                  <tr key={r.id} className={selected ? 'fin-row-selected' : undefined}>
                    <Td label="Select" className="fin-check-col">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleRow(r.id)}
                        aria-label={`Select ${r.description || r.id}`}
                      />
                    </Td>
                    <Td label="Date">{formatExpenseDate(r.date)}</Td>
                    <Td label="Category">
                      <span className={`badge-cat ${r.category?.includes('Freight') ? 'badge-freight' : 'badge-customs'}`}>
                        {r.category}
                      </span>
                    </Td>
                    <Td label="Description">{r.description}</Td>
                    <Td label="Amount">{fmtCurrency(currency, r.amountXaf)}</Td>
                    <Td label="Receipts">
                      {(() => {
                        const receipts = Array.isArray(r.receipts) ? r.receipts.filter(Boolean) : [];
                        if (!receipts.length) {
                          return <span className="fin-receipt-none">—</span>;
                        }
                        return (
                          <button
                            type="button"
                            className="fin-receipt-cell"
                            onClick={() => setViewRow(r)}
                            title={t('View receipts')}
                            aria-label={t('View receipts')}
                          >
                            <img src={mediaSrc(receipts[0])} alt="" className="fin-receipt-thumb" />
                            {receipts.length > 1 ? (
                              <span className="fin-receipt-count">+{receipts.length - 1}</span>
                            ) : null}
                          </button>
                        );
                      })()}
                    </Td>
                    <Td label="Related">{r.relatedTo}</Td>
                    <Td label="Status"><span className={r.auto ? 'badge-synced' : 'badge-completed'}>{r.status}</span></Td>
                    <Td label="Actions" className="at-card-actions">
                      <FinanceTableActions
                        row={r}
                        onView={setViewRow}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    </Td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={9} className="fin-empty">
                    No expenses in this period. Use Record Expense to add one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={pagination.page || page}
          pages={pagination.pages || 1}
          total={pagination.total ?? rows.length}
          pageSize={pagination.pageSize || pageSize}
          onPage={setPage}
          onPageSize={(size) => { setPageSize(size); setPage(1); }}
          noun="expenses"
          disabled={loading}
        />
      </div>

      <RecordExpenseModal open={Boolean(viewRow)} mode="view" record={viewRow} onClose={() => setViewRow(null)} />
      <RecordExpenseModal
        open={Boolean(editRow)}
        mode="edit"
        record={editRow}
        saving={saving}
        onClose={() => setEditRow(null)}
        onSubmit={handleEditSave}
      />
    </>
  );
}
