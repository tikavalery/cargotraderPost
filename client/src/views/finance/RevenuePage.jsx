import { useEffect, useMemo, useRef, useState } from 'react';
import FinanceLayout from '../../components/finance/FinanceLayout';
import KpiCard from '../../components/finance/KpiCard';
import { ExportButtons, RangePills } from '../../components/finance/FinanceNavbar';
import { RecordRevenueModal } from '../../components/finance/RecordModals';
import FinanceTableActions, { canModifyFinanceEntry } from '../../components/finance/FinanceTableActions';
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
  exportRevenueCsv,
  printRevenueReport,
  printSelectedRevenue
} from '../../utils/revenueExport';

function sourceBadgeClass(source) {
  if (source === 'POS') return 'badge-pos';
  if (source === 'Marketplace') return 'badge-marketplace';
  if (source === 'Wholesale') return 'badge-wholesale';
  if (source === 'Shipment Sales') return 'badge-shipment';
  if (source === 'Manual') return 'badge-manual';
  return 'badge-source';
}

export default function RevenuePage() {
  const t = useT();
  const { currency, range, setRange } = useFinanceFilters();
  const { showToast } = useToast();
  const rowsRef = useRef([]);

  const handleExport = (fmt) => {
    const rows = rowsRef.current || [];
    if (!rows.length) {
      showToast(t('No revenue to export'));
      return;
    }
    if (fmt === 'excel') {
      const ok = exportRevenueCsv(rows, { filename: `revenue-all-${rows.length}.csv` });
      if (ok) showToast(t('Exported {count} revenue entries', { count: rows.length }), 'success');
      return;
    }
    if (fmt === 'pdf') {
      const ok = printRevenueReport(rows, { title: t('Revenue Report') });
      if (!ok) showToast(t('Allow pop-ups to export PDF'));
      else showToast(t('Print dialog opened — save as PDF'), 'success');
    }
  };

  return (
    <FinanceLayout
      breadcrumbs={[{ label: 'CargoTrader', to: '/dashboard' }, { label: 'Finance', to: '/finance' }, { label: 'Revenue', current: true }]}
      title={<><i className="fas fa-arrow-trend-up" /> {t('Revenue')}</>}
      subtitle={t('All Sources · This Month')}
      hideGlobalFilters
      showSearch
      headerRight={({ openRecordRevenue }) => (
        <div className="fin-dashboard-actions">
          <button
            type="button"
            className="btn-fin-revenue"
            onClick={openRecordRevenue}
            title={t('Record Revenue')}
            aria-label={t('Record Revenue')}
          >
            <i className="fas fa-plus-circle" />
            <span className="fin-chrome-label">{t('Record Revenue')}</span>
          </button>
          <RangePills value={range} onChange={setRange} />
          <ExportButtons onExport={handleExport} />
        </div>
      )}
    >
      {({ tick, refresh }) => (
        <RevenueBody
          currency={currency}
          range={range}
          tick={tick}
          refresh={refresh}
          rowsRef={rowsRef}
        />
      )}
    </FinanceLayout>
  );
}

function RevenueBody({ currency, range, tick, refresh, rowsRef }) {
  const { showToast } = useToast();
  const [summary, setSummary] = useState(null);
  const [list, setList] = useState({ data: [] });
  const [loading, setLoading] = useState(true);
  const [viewRow, setViewRow] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const rows = useMemo(
    () => (list.data || []).map((r) => ({ ...r, selectId: r.id })),
    [list.data]
  );
  const selection = usePurchaseSelection(rows);
  const pagination = list.pagination || { page: 1, pageSize, total: rows.length, pages: 1 };

  useEffect(() => {
    if (rowsRef) rowsRef.current = rows;
  }, [rows, rowsRef]);

  useEffect(() => {
    selection.clearSelection();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset selection when filters change
  }, [currency, range, tick, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [currency, range, tick]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    financeApi.revenueOverview({ range, currency, page, pageSize })
      .then((res) => {
        if (cancelled) return;
        const payload = res.data?.data;
        if (!payload) return;
        setSummary(payload.summary);
        setList(payload.list || { data: [], pagination: { page: 1, pageSize, total: 0, pages: 1 } });
      })
      .catch(() => { if (!cancelled) showToast('Unable to load revenue'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [currency, range, tick, page, pageSize, showToast]);

  const handleView = async (row) => {
    try {
      const res = await financeApi.getRevenue(row.id);
      setViewRow(res.data?.data || row);
    } catch {
      setViewRow(row);
    }
  };

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
    if (!window.confirm('Delete this revenue entry?')) return;
    try {
      await financeApi.deleteRevenue(row.id);
      showToast('Revenue deleted', 'success');
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
      await financeApi.updateRevenue(editRow.id, data);
      showToast('Revenue updated', 'success');
      setEditRow(null);
      refresh();
    } catch (e) {
      showToast(e.response?.data?.message || 'Unable to update revenue');
    } finally {
      setSaving(false);
    }
  };

  const handleExportAll = () => {
    if (!rows.length) {
      showToast('No revenue to export');
      return;
    }
    const ok = exportRevenueCsv(rows, { filename: `revenue-all-${rows.length}.csv` });
    if (ok) showToast(`Exported ${rows.length} revenue entr${rows.length === 1 ? 'y' : 'ies'}`, 'success');
  };

  const handleExportSelected = () => {
    if (!selection.count) {
      showToast('Select revenue entries to export');
      return;
    }
    const ok = exportRevenueCsv(selection.selectedRows, {
      filename: `revenue-selected-${selection.count}.csv`
    });
    if (ok) showToast(`Exported ${selection.count} selected entr${selection.count === 1 ? 'y' : 'ies'}`, 'success');
  };

  const handlePrintSelected = () => {
    if (!selection.count) {
      showToast('Select revenue entries to print');
      return;
    }
    const ok = printSelectedRevenue(selection.selectedRows);
    if (!ok) showToast('Allow pop-ups to print selected revenue');
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
          ? 'Delete this revenue entry?'
          : `Delete ${deletable.length} selected revenue entries?`;

    if (!window.confirm(msg)) return;

    setDeleting(true);
    let okCount = 0;
    let failCount = 0;
    for (const row of deletable) {
      try {
        await financeApi.deleteRevenue(row.id);
        okCount += 1;
      } catch {
        failCount += 1;
      }
    }
    setDeleting(false);
    selection.clearSelection();
    if (okCount) {
      showToast(
        okCount === 1 ? 'Revenue deleted' : `${okCount} revenue entries deleted`,
        'success'
      );
      refresh();
    }
    if (failCount) showToast(`${failCount} delete(s) failed`);
  };

  if (loading && !summary) return <div className="fin-empty">Loading…</div>;
  if (!summary) return <div className="fin-empty">Unable to load revenue</div>;

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
        <KpiCard label="Total Revenue" value={summary.total} accent="green" />
        <KpiCard label="POS Revenue" value={fmtCurrency(currency, summary.posXaf)} />
        <KpiCard label="Marketplace Revenue" value={fmtCurrency(currency, summary.marketplaceXaf)} />
        <KpiCard label="Commissions Earned" value={fmtCurrency(currency, summary.commissionsXaf)} />
        <KpiCard label="Revenue Growth" value="+0%" />
      </div>

      <div className="fin-card fin-revenue-table-card" style={{ marginTop: 14 }}>
        <div className="fin-card-header">
          <div>
            <div className="fin-card-title">Revenue</div>
            <p className="fin-card-sub">All income from POS, shipments, sales, and manual entries</p>
          </div>
          <button type="button" className="fin-export-all-btn" onClick={handleExportAll}>
            <i className="fas fa-file-excel" /> Export All Revenue
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
                <th>Date</th>
                <th>Source</th>
                <th>Amount</th>
                <th>Reference</th>
                <th>Status</th>
                <th>Actions</th>
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
                        aria-label={`Select ${r.reference || r.id}`}
                      />
                    </Td>
                    <Td label="Date">{r.date ? new Date(r.date).toISOString().slice(0, 10) : '—'}</Td>
                    <Td label="Source"><span className={sourceBadgeClass(r.source)}>{r.source}</span></Td>
                    <Td label="Amount">{fmtCurrency(currency, r.amountXaf)}</Td>
                    <Td label="Reference">{r.reference}</Td>
                    <Td label="Status"><span className={r.auto ? 'badge-synced' : 'badge-completed'}>{r.status}</span></Td>
                    <Td label="Actions" className="at-card-actions">
                      <FinanceTableActions
                        row={r}
                        onView={handleView}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    </Td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={7} className="fin-empty">
                    No revenue in this period. Record revenue manually or complete sales in POS, shipments, and other modules.
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
          noun="revenue entries"
          disabled={loading}
        />
      </div>

      <RecordRevenueModal
        open={Boolean(viewRow)}
        mode="view"
        record={viewRow}
        onClose={() => setViewRow(null)}
      />
      <RecordRevenueModal
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
