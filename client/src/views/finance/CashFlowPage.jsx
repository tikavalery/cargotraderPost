import { useEffect, useMemo, useRef, useState } from 'react';
import FinanceLayout from '../../components/finance/FinanceLayout';
import CashFlowKpiCard from '../../components/finance/CashFlowKpiCard';
import { ExportButtons } from '../../components/finance/FinanceNavbar';
import Td from '../../components/common/Td';
import MobileSelectAllBar from '../../components/common/MobileSelectAllBar';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useT } from '../../i18n/LanguageContext';
import { financeApi } from '../../services/financeApi';
import { usePurchaseSelection } from '../../hooks/usePurchaseSelection';
import { emptyCashFlowData, normalizeCashFlowData } from '../../utils/normalizeCashFlow';
import { useFinanceFilters } from '../../context/FinanceFilterContext';
import {
  canDeleteCashFlowEntry,
  exportCashFlowCsv,
  printCashFlowReport,
  printSelectedCashFlow
} from '../../utils/cashFlowExport';
import TablePagination from '../../components/common/TablePagination';

const RANGE_OPTS = [
  { id: 'today', label: 'Today' },
  { id: 'month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' }
];

const TABLE_TABS = [
  { id: 'all', label: 'All' },
  { id: 'income', label: 'Income' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'refunds', label: 'Refunds' },
  { id: 'synced', label: 'Synced' }
];

const PAGE_SIZES = [10, 25, 50, 100];

function formatDateRange(range) {
  const now = new Date();
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (range === 'today') return fmt(now);

  if (range === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return `${fmt(start)} — ${fmt(end)}`;
  }

  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return `${fmt(start)} — ${fmt(now)}`;
}

function displayStatus(status) {
  return status === 'Recorded' ? 'Pending' : status;
}

function AddEntryChooser({ open, onClose, onPickInflow, onPickOutflow }) {
  if (!open) return null;
  return (
    <div className="pos-modal-overlay open" onClick={onClose} role="presentation">
      <div className="pos-modal fin-expense-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="cf-add-entry-title">
        <div className="pos-modal-header">
          <div>
            <div className="pos-modal-title" id="cf-add-entry-title">Add Cash Flow Entry</div>
            <p className="fin-modal-sub">Choose inflow (money in) or outflow (money out)</p>
          </div>
          <button type="button" className="pos-modal-close" onClick={onClose} aria-label="Close">
            <i className="fas fa-times" />
          </button>
        </div>
        <div className="pos-modal-body">
          <div className="cf-add-entry-choices">
            <button type="button" className="cf-add-entry-choice inflow" onClick={onPickInflow}>
              <i className="fas fa-arrow-down" />
              <strong>Inflow</strong>
              <span>Record revenue / money in</span>
            </button>
            <button type="button" className="cf-add-entry-choice outflow" onClick={onPickOutflow}>
              <i className="fas fa-arrow-up" />
              <strong>Outflow</strong>
              <span>Record expense / money out</span>
            </button>
          </div>
        </div>
        <div className="pos-modal-footer">
          <button type="button" className="pos-btn-outline" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function CashFlowPage() {
  const t = useT();
  const { user } = useAuth();
  const { showToast } = useToast();
  const businessName = user?.businessName || 'That Store';
  const rowsRef = useRef([]);

  const handleExport = (fmt) => {
    const rows = rowsRef.current || [];
    if (!rows.length) {
      showToast(t('No cash flow entries to export'));
      return;
    }
    if (fmt === 'excel') {
      const ok = exportCashFlowCsv(rows, { filename: `cash-flow-all-${rows.length}.csv` });
      if (ok) showToast(t('Exported {count} cash flow entries', { count: rows.length }), 'success');
      return;
    }
    if (fmt === 'pdf') {
      const ok = printCashFlowReport(rows, { title: t('Cash Flow Report') });
      if (!ok) showToast(t('Allow pop-ups to export PDF'));
      else showToast(t('Print dialog opened — save as PDF'), 'success');
    }
  };

  return (
    <FinanceLayout
      breadcrumbs={[
        { label: 'CargoTrader', to: '/dashboard' },
        { label: 'Finance', to: '/finance' },
        { label: 'Cash Flow', current: true }
      ]}
      title={<><i className="fas fa-water" /> {t('Cash Flow')}</>}
      subtitle={`${businessName} · ${t('Full ledger')}`}
      hideGlobalFilters
      showSearch
      searchPlaceholder={t('Search cash flow records…')}
      headerRight={({ openRecordRevenue, openRecordExpense }) => (
        <CashFlowHeaderActions
          onExport={handleExport}
          openRecordRevenue={openRecordRevenue}
          openRecordExpense={openRecordExpense}
        />
      )}
    >
      {({ tick, refresh }) => (
        <CashFlowBody tick={tick} refresh={refresh} rowsRef={rowsRef} />
      )}
    </FinanceLayout>
  );
}

function CashFlowHeaderActions({ onExport, openRecordRevenue, openRecordExpense }) {
  const t = useT();
  const [chooserOpen, setChooserOpen] = useState(false);
  return (
    <>
      <div className="fin-dashboard-actions">
        <button
          type="button"
          className="btn-fin-add-entry"
          onClick={() => setChooserOpen(true)}
          title={t('Add Entry')}
          aria-label={t('Add Entry')}
        >
          <i className="fas fa-plus-circle" />
          <span className="fin-chrome-label">{t('Add Entry')}</span>
        </button>
        <ExportButtons onExport={onExport} />
      </div>
      <AddEntryChooser
        open={chooserOpen}
        onClose={() => setChooserOpen(false)}
        onPickInflow={() => {
          setChooserOpen(false);
          openRecordRevenue?.();
        }}
        onPickOutflow={() => {
          setChooserOpen(false);
          openRecordExpense?.();
        }}
      />
    </>
  );
}

function CashFlowBody({ tick, refresh, rowsRef }) {
  const { showToast } = useToast();
  const { currency } = useFinanceFilters();
  const [data, setData] = useState(() => emptyCashFlowData());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [range, setRange] = useState('month');
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    financeApi.cashFlow({ currency, range, page, pageSize, tab })
      .then((res) => {
        if (!cancelled) setData(normalizeCashFlowData(res.data?.data));
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err.response?.data?.message || 'Could not load cash flow');
          setData(emptyCashFlowData());
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currency, range, page, pageSize, tab, tick]);

  useEffect(() => { setPage(1); }, [tab, range]);

  const { summary, rows, tabCounts, pagination } = data;

  const pageRows = useMemo(
    () => (rows || []).map((r) => ({ ...r, selectId: r.id })),
    [rows]
  );

  const selection = usePurchaseSelection(pageRows);

  useEffect(() => {
    if (rowsRef) rowsRef.current = pageRows;
  }, [pageRows, rowsRef]);

  useEffect(() => {
    selection.clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset selection when filters change
  }, [range, tab, tick, page, pageSize]);

  const totalPages = Math.max(1, pagination?.pages || 1);
  const totalRecords = pagination?.total ?? pageRows.length;

  useEffect(() => {
    setPage((prev) => (prev > totalPages ? totalPages : prev));
  }, [totalPages]);

  const handleExportAll = () => {
    if (!pageRows.length) {
      showToast('No cash flow entries to export');
      return;
    }
    const ok = exportCashFlowCsv(pageRows, { filename: `cash-flow-page-${pageRows.length}.csv` });
    if (ok) showToast(`Exported ${pageRows.length} cash flow entr${pageRows.length === 1 ? 'y' : 'ies'} on this page`, 'success');
  };

  const handleExportSelected = () => {
    if (!selection.count) {
      showToast('Select cash flow entries to export');
      return;
    }
    const ok = exportCashFlowCsv(selection.selectedRows, {
      filename: `cash-flow-selected-${selection.count}.csv`
    });
    if (ok) showToast(`Exported ${selection.count} selected entr${selection.count === 1 ? 'y' : 'ies'}`, 'success');
  };

  const handlePrintSelected = () => {
    if (!selection.count) {
      showToast('Select cash flow entries to print');
      return;
    }
    const ok = printSelectedCashFlow(selection.selectedRows);
    if (!ok) showToast('Allow pop-ups to print selected entries');
  };

  const handleBulkDelete = async () => {
    if (!selection.count) return;
    const deletable = selection.selectedRows.filter(canDeleteCashFlowEntry);
    if (!deletable.length) {
      showToast('Selected entries are auto-synced and cannot be deleted');
      return;
    }

    const skipped = selection.count - deletable.length;
    const msg =
      skipped > 0
        ? `Delete ${deletable.length} recorded entr${deletable.length === 1 ? 'y' : 'ies'}? ${skipped} auto-synced entr${skipped === 1 ? 'y' : 'ies'} will be skipped.`
        : deletable.length === 1
          ? 'Delete this cash flow entry?'
          : `Delete ${deletable.length} selected cash flow entries?`;

    if (!window.confirm(msg)) return;

    setDeleting(true);
    let okCount = 0;
    let failCount = 0;
    for (const row of deletable) {
      try {
        await financeApi.deleteCashFlow(row.id);
        okCount += 1;
      } catch {
        failCount += 1;
      }
    }
    setDeleting(false);
    selection.clearSelection();
    if (okCount) {
      showToast(
        okCount === 1 ? 'Cash flow entry deleted' : `${okCount} cash flow entries deleted`,
        'success'
      );
      refresh?.();
    }
    if (failCount) showToast(`${failCount} delete(s) failed`);
  };

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
      <div className="cf-toolbar">
        <div className="cf-toolbar-left">
          <div className="cf-date-range">
            <i className="fas fa-calendar" />
            {formatDateRange(range)}
          </div>
          <div className="cf-range-pills">
            {RANGE_OPTS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`cf-range-pill${range === opt.id ? ' active' : ''}`}
                onClick={() => setRange(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && <div className="cf-banner loading"><i className="fas fa-spinner fa-spin" /> Loading cash flow…</div>}
      {loadError && !loading && <div className="cf-banner error" role="alert">{loadError}</div>}

      <div className="cf-kpi-row cf-kpi-row-mvp">
        <CashFlowKpiCard
          label="Total Inflow"
          primary={summary.inflowFmt || summary.inflowXafFmt}
          tone="inflow"
        />
        <CashFlowKpiCard
          label="Total Outflow"
          primary={summary.outflowFmt || summary.outflowXafFmt}
          tone="outflow"
        />
        <CashFlowKpiCard
          label="Net Cash Flow"
          primary={summary.netFmt || summary.netXafFmt}
          tone="net"
        />
      </div>

      <div className="fin-card cf-table-card">
        <div className="fin-card-header">
          <div className="fin-card-title">Cash Flow Ledger</div>
          <button type="button" className="fin-export-all-btn" onClick={handleExportAll}>
            <i className="fas fa-file-excel" /> Export All Cash Flow
          </button>
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

        <div className="cf-table-tabs">
          {TABLE_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`cf-table-tab${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              <span className="cf-tab-count">{tabCounts[t.id] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="fin-table-wrap cf-table-wrap">
          <MobileSelectAllBar
            checked={allVisibleSelected && pageRows.length > 0}
            indeterminate={someVisibleSelected}
            onChange={() => toggleAll(visibleIds)}
            disabled={!pageRows.length}
            countLabel={pageRows.length ? `${pageRows.length} entr${pageRows.length !== 1 ? 'ies' : 'y'}` : ''}
          />
          <table className="fin-table cf-table cf-table-mvp at-responsive-table">
            <thead>
              <tr>
                <th className="fin-check-col">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected && pageRows.length > 0}
                    ref={(el) => { if (el) el.indeterminate = someVisibleSelected; }}
                    onChange={() => toggleAll(visibleIds)}
                    aria-label="Select all"
                    disabled={!pageRows.length}
                  />
                </th>
                <th>Date</th>
                <th>Description</th>
                <th>Source</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length ? pageRows.map((r) => {
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
                    <Td label="Date">{r.dateLabel}</Td>
                    <Td label="Description" className="cf-desc">{r.description}</Td>
                    <Td label="Source"><span className={r.sourceBadge || 'badge-source'}>{r.source}</span></Td>
                    <Td label="Amount" className={r.type === 'revenue' ? 'profit-pos' : 'profit-neg'}>{r.amountFmt || r.amountXafFmt}</Td>
                    <Td label="Status">
                      <span className={`cf-status-badge${r.status === 'Synced' ? ' synced' : ' pending'}`}>
                        {r.status === 'Synced' && <i className="fas fa-check" />}
                        {displayStatus(r.status)}
                      </span>
                    </Td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} className="fin-empty">
                    No transactions in this view.
                  </td>
                </tr>
              )}
            </tbody>
            {pageRows.length > 0 && tab === 'all' && (
              <tfoot>
                <tr className="cf-totals-row">
                  <td colSpan={4}><strong>Period summary</strong></td>
                  <td className={summary.netPositive ? 'profit-pos' : 'profit-neg'}>
                    Net: {summary.netFmt || summary.netXafFmt}
                  </td>
                  <td>
                    <span className="cf-synced-count">{summary.syncedCount} Synced</span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <TablePagination
          page={page}
          pages={totalPages}
          total={totalRecords}
          pageSize={pageSize}
          pageSizes={PAGE_SIZES}
          onPage={setPage}
          onPageSize={(size) => { setPageSize(size); setPage(1); }}
          noun="records"
          disabled={loading}
        />
      </div>
    </>
  );
}
