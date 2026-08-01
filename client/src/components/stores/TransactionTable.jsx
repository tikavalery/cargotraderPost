import { formatXaf } from '../../utils/format';
import { txnStatusClass, txnStatusLabel } from '../../constants/salesReturns';
import { isRefundableTransaction } from '../../utils/transactionExport';
import Td from '../common/Td';
import MobileSelectAllBar from '../common/MobileSelectAllBar';
import { useT } from '../../i18n/LanguageContext';

export default function TransactionTable({
  transactions,
  loading,
  selection,
  onView,
  onReturn,
  onExportSelected,
  onPrintSelected,
  onRefundSelected,
  canManage = false
}) {
  const t = useT();

  if (loading) {
    return (
      <div className="pos-card">
        <div className="pos-empty-row">{t('Loading…')}</div>
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
    count,
    clearSelection
  } = selection;

  const colCount = 9;

  return (
    <div className="pos-card">
      {count > 0 && (
        <div className="txn-selection-bar">
          <div className="pur-bulk-actions">
            <span className="pur-bulk-count">{count} selected</span>
            <button type="button" className="pur-bulk-btn" onClick={onExportSelected}>
              <i className="fas fa-download" /> Export Selected
            </button>
            <button type="button" className="pur-bulk-btn" onClick={onPrintSelected}>
              <i className="fas fa-print" /> Print Selected Transactions
            </button>
            {canManage && onRefundSelected && (
              <button
                type="button"
                className="pur-bulk-btn"
                onClick={onRefundSelected}
                title="Select exactly one completed or partially returned transaction"
              >
                <i className="fas fa-undo" /> {t('Refund Selected')}
              </button>
            )}
            <button type="button" className="pur-bulk-btn" onClick={clearSelection}>
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="history-table-wrapper">
        <MobileSelectAllBar
          checked={allVisibleSelected && transactions.length > 0}
          indeterminate={someVisibleSelected}
          onChange={() => toggleAll(visibleIds)}
          disabled={!transactions.length}
          countLabel={
            transactions.length
              ? `${transactions.length} transaction${transactions.length !== 1 ? 's' : ''}`
              : ''
          }
        />
        <table className="history-table at-responsive-table">
          <thead>
            <tr>
              <th className="pur-check-col">
                <input
                  type="checkbox"
                  checked={allVisibleSelected && transactions.length > 0}
                  ref={(el) => {
                    if (el) el.indeterminate = someVisibleSelected;
                  }}
                  onChange={() => toggleAll(visibleIds)}
                  aria-label="Select all"
                />
              </th>
              <th>{t('Date')}</th>
              <th>{t('ID')}</th>
              <th>{t('Store')}</th>
              <th>{t('Items')}</th>
              <th>{t('Total')}</th>
              <th>{t('Payment')}</th>
              <th>{t('Status')}</th>
              <th>{t('Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="pos-empty-row">
                  {t('No transactions')}
                </td>
              </tr>
            ) : (
              transactions.map((txn) => {
                const id = txn.selectId || txn.transactionId;
                const selected = selectedIds.has(id);
                const canReturnTxn = canManage && onReturn && isRefundableTransaction(txn);
                return (
                  <tr key={id} className={selected ? 'row-selected' : undefined}>
                    <Td label="" hideLabel className="pur-check-col" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleRow(id)}
                        aria-label={`Select ${txn.transactionId}`}
                      />
                    </Td>
                    <Td label={t('Date')}>
                      {txn.date ? new Date(txn.date).toISOString().slice(0, 10) : '—'}
                    </Td>
                    <Td label={t('ID')}>
                      <span className="history-txn-id">{txn.transactionId}</span>
                    </Td>
                    <Td label={t('Store')}>{txn.storeName}</Td>
                    <Td label={t('Items')}>{txn.itemCount || txn.lines?.length || 0}</Td>
                    <Td label={t('Total')}>{formatXaf(txn.total)}</Td>
                    <Td label={t('Payment')}>{txn.payment}</Td>
                    <Td label={t('Status')}>
                      <div className="pos-txn-status-cell">
                        <span className={`pos-txn-status ${txnStatusClass(txn.status)}`}>
                          {txnStatusLabel(txn.status)}
                        </span>
                        {Number(txn.refundedTotal) > 0 && (
                          <span className="pos-txn-refunded-hint">
                            {t('Refunded')} {formatXaf(txn.refundedTotal)}
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td label={t('Actions')} className="pos-txn-actions at-card-actions">
                      {onView && (
                        <button
                          type="button"
                          className="tbl-btn-view"
                          onClick={() => onView(txn)}
                          title={t('View')}
                        >
                          <i className="fas fa-eye" />
                        </button>
                      )}
                      {canReturnTxn && (
                        <button
                          type="button"
                          className="tbl-btn-return"
                          onClick={() => onReturn(txn)}
                          title={t('Process Return')}
                          aria-label={t('Process Return')}
                        >
                          <i className="fas fa-undo" />
                        </button>
                      )}
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="pur-table-footer">
        <span className="pur-table-count">
          {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
        </span>
        {count === 0 && (
          <span className="pur-table-hint">
            Select rows for export, print{canManage ? ', or refund' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
