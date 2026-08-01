import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../../layout/AppShell';
import { usePosStore } from '../../context/PosStoreContext';
import { useToast } from '../../context/ToastContext';
import { useT } from '../../i18n/LanguageContext';
import { usePermissions } from '../../hooks/usePermissions';
import { usePosTransactions } from '../../hooks/usePosTransactions';
import { usePurchaseSelection } from '../../hooks/usePurchaseSelection';
import TransactionTable from '../../components/stores/TransactionTable';
import TransactionDetailModal from '../../components/stores/TransactionDetailModal';
import ProcessSaleReturnModal from '../../components/stores/ProcessSaleReturnModal';
import TablePagination from '../../components/common/TablePagination';
import {
  exportTransactionsCsv,
  isRefundableTransaction,
  printSelectedTransactions,
  printTransactionsReport
} from '../../utils/transactionExport';

export default function TransactionsPage() {
  const t = useT();
  const { storeId } = usePosStore();
  const { showToast } = useToast();
  const { canManageSales } = usePermissions();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { transactions, pagination, loading, refetch } = usePosTransactions({
    storeId,
    page,
    limit: pageSize
  });
  const [detail, setDetail] = useState(null);
  const [returnTxnId, setReturnTxnId] = useState(null);

  useEffect(() => {
    setPage(1);
  }, [storeId]);

  const rows = useMemo(
    () => transactions.map((txn) => ({ ...txn, selectId: txn.transactionId })),
    [transactions]
  );
  const selection = usePurchaseSelection(rows);

  const openReturn = (txn) => {
    setDetail(null);
    setReturnTxnId(txn.transactionId);
  };

  const handleReturnSuccess = () => {
    refetch();
    selection.clearSelection();
    setReturnTxnId(null);
  };

  const handleExportAll = () => {
    if (!rows.length) {
      showToast('No transactions to export');
      return;
    }
    const ok = exportTransactionsCsv(rows, {
      filename: `transactions-all-${rows.length}.csv`
    });
    if (ok) showToast(`Exported ${rows.length} transaction(s)`, 'success');
  };

  const handlePrintReport = () => {
    if (!rows.length) {
      showToast('No transactions to print');
      return;
    }
    const ok = printTransactionsReport(rows, { title: 'Transactions Report' });
    if (!ok) showToast('Allow pop-ups to print the transactions report');
  };

  const handleExportSelected = () => {
    if (!selection.count) {
      showToast('Select transactions to export');
      return;
    }
    const ok = exportTransactionsCsv(selection.selectedRows, {
      filename: `transactions-selected-${selection.count}.csv`
    });
    if (ok) showToast(`Exported ${selection.count} selected transaction(s)`, 'success');
  };

  const handlePrintSelected = () => {
    if (!selection.count) {
      showToast('Select transactions to print');
      return;
    }
    const ok = printSelectedTransactions(selection.selectedRows);
    if (!ok) showToast('Allow pop-ups to print selected transactions');
  };

  const handleRefundSelected = () => {
    const eligible = selection.selectedRows.filter(isRefundableTransaction);
    if (!eligible.length) {
      showToast('Select a completed or partially returned transaction to refund');
      return;
    }
    if (eligible.length !== 1 || selection.count !== 1) {
      showToast('Select exactly one eligible transaction to refund');
      return;
    }
    openReturn(eligible[0]);
  };

  return (
    <>
      <AppShell
        className="app-shell--transactions"
        hideSearch
        breadcrumbs={[
          { label: 'Stores', to: '/stores' },
          { label: 'POS', to: '/stores/pos' },
          { label: 'Transactions', current: true }
        ]}
        userMenuProps={{ avatarVariant: 'primary' }}
        navbarRight={
          <div className="header-actions">
            <Link
              to="/stores/pos"
              className="pos-back-link"
              title={t('Back to Terminal')}
              aria-label={t('Back to Terminal')}
            >
              <i className="fas fa-arrow-left" />
              <span className="txn-chrome-label">{t('Back to Terminal')}</span>
            </Link>
          </div>
        }
      >
        <div className="content txn-page">
          <div className="pos-page-header pur-all-header">
            <div>
              <h1>
                <i className="fas fa-receipt" /> {t('All Transactions')}
              </h1>
              <p className="page-sub">
                {t('View sales, process returns, and refund directly from each transaction')}
              </p>
            </div>
            <div className="header-btns">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleExportAll}
                title={t('Export All Transactions')}
                aria-label={t('Export All Transactions')}
              >
                <i className="fas fa-file-excel" />
                <span className="txn-chrome-label">{t('Export All Transactions')}</span>
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handlePrintReport}
                title={t('Print Transactions Report')}
                aria-label={t('Print Transactions Report')}
              >
                <i className="fas fa-print" />
                <span className="txn-chrome-label">{t('Print Transactions Report')}</span>
              </button>
            </div>
          </div>

          <TransactionTable
            transactions={rows}
            loading={loading}
            selection={selection}
            onView={setDetail}
            onReturn={canManageSales ? openReturn : undefined}
            onExportSelected={handleExportSelected}
            onPrintSelected={handlePrintSelected}
            onRefundSelected={canManageSales ? handleRefundSelected : undefined}
            canManage={canManageSales}
          />
          <TablePagination
            page={pagination.page || page}
            pages={pagination.pages || 1}
            total={pagination.total ?? rows.length}
            pageSize={pagination.limit || pageSize}
            onPage={setPage}
            onPageSize={(size) => { setPageSize(size); setPage(1); }}
            noun="transactions"
            disabled={loading}
          />
        </div>
      </AppShell>

      <TransactionDetailModal
        transaction={detail}
        open={!!detail}
        onClose={() => setDetail(null)}
        onReturn={canManageSales ? openReturn : undefined}
        canReturn={canManageSales}
      />

      <ProcessSaleReturnModal
        open={Boolean(returnTxnId)}
        transactionId={returnTxnId}
        onClose={() => setReturnTxnId(null)}
        onSuccess={handleReturnSuccess}
        showToast={showToast}
      />
    </>
  );
}
