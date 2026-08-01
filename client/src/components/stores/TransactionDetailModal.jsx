import { formatXaf } from '../../utils/format';
import { txnStatusClass, txnStatusLabel } from '../../constants/salesReturns';
import DetailModalFrame from '../common/DetailModalFrame';
import DetailFieldGrid from '../common/DetailFieldGrid';
import TransactionLineDetailCard from './detail/TransactionLineDetailCard';

function TransactionDetailHeader({ transaction }) {
  return (
    <div className="at-detail-header at-detail-header-pinned">
      <div className="at-detail-header-left">
        <div className="at-detail-header-icon">
          <i className="fas fa-receipt" />
        </div>
        <div className="at-detail-header-title">Transaction Details</div>
      </div>
      <div className="at-detail-header-right">
        <span className={`pos-txn-status ${txnStatusClass(transaction.status)}`}>
          {txnStatusLabel(transaction.status)}
        </span>
        <div className="at-detail-sku-pill">{transaction.transactionId}</div>
      </div>
    </div>
  );
}

function TransactionDetailStats({ transaction }) {
  const itemCount =
    transaction.itemCount ||
    (transaction.lines || []).reduce((s, l) => s + (l.qty || 0), 0);

  const stats = [
    {
      icon: 'fa-coins',
      tone: 'green',
      label: 'Total',
      value: formatXaf(transaction.total),
      sub: transaction.payment || '—'
    },
    {
      icon: 'fa-money-bill-wave',
      tone: 'orange',
      label: 'Payment',
      value: transaction.payment || '—',
      sub: transaction.tendered ? `Tendered ${formatXaf(transaction.tendered)}` : '—'
    },
    {
      icon: 'fa-boxes',
      tone: 'teal',
      label: 'Items',
      value: String(itemCount),
      sub: `${(transaction.lines || []).length} line${(transaction.lines || []).length !== 1 ? 's' : ''}`
    }
  ];

  if ((transaction.refundedTotal || 0) > 0) {
    stats.push({
      icon: 'fa-undo',
      tone: 'orange',
      label: 'Refunded',
      value: formatXaf(transaction.refundedTotal),
      sub: 'to date'
    });
  }

  return (
    <div className="at-detail-stats">
      {stats.map((s) => (
        <div key={s.label} className="at-detail-stat">
          <div className={`at-detail-stat-icon ${s.tone}`}>
            <i className={`fas ${s.icon}`} />
          </div>
          <div>
            <div className="at-detail-stat-label">{s.label}</div>
            <div className="at-detail-stat-value">{s.value}</div>
            {s.sub !== '—' && <div className="at-detail-stat-sub">{s.sub}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TransactionDetailModal({
  transaction,
  open,
  onClose,
  onReturn,
  canReturn = false
}) {
  if (!transaction) return null;

  const showReturn =
    canReturn &&
    onReturn &&
    ['completed', 'partially_returned'].includes(transaction.status);

  const dateStr = transaction.date
    ? new Date(transaction.date).toLocaleString('fr-CM')
    : '—';

  const summaryFields = [
    { label: 'Store', value: transaction.storeName || '—' },
    { label: 'Date & Time', value: dateStr },
    { label: 'Customer', value: transaction.customerName || 'Walk-in Customer' },
    { label: 'Cashier', value: transaction.cashierName || '—' },
    { label: 'Subtotal', value: formatXaf(transaction.subtotal ?? transaction.total) },
    { label: 'Discount', value: formatXaf(transaction.discount || 0) },
    { label: 'Tax', value: formatXaf(transaction.tax || 0) },
    { label: 'Change Due', value: formatXaf(transaction.change || 0) }
  ];

  return (
    <DetailModalFrame
      open={open}
      stack
      onClose={onClose}
      ariaLabelledBy="txn-detail-title"
      header={<TransactionDetailHeader transaction={transaction} />}
      footer={{
        left: showReturn ? (
          <button type="button" className="pos-btn-primary" onClick={() => onReturn(transaction)}>
            <i className="fas fa-undo" /> Process Return
          </button>
        ) : null
      }}
    >
      <div className="at-detail-card">
        <TransactionDetailStats transaction={transaction} />
        <div className="at-detail-body">
          <h2 className="at-detail-name" id="txn-detail-title">
            {transaction.storeName} · {formatXaf(transaction.total)}
          </h2>
          <div className="at-detail-meta">
            <span>
              <i className="fas fa-store" />
              {transaction.storeName || '—'}
            </span>
            <span>
              <i className="fas fa-calendar" />
              {dateStr}
            </span>
          </div>
          <DetailFieldGrid fields={summaryFields} />
        </div>
      </div>

      <div className="pos-txn-lines-section">
        <div className="pos-txn-lines-heading">Items sold</div>
        {(transaction.lines || []).length ? (
          <div className="pos-txn-line-list">
            {(transaction.lines || []).map((line) => (
              <TransactionLineDetailCard
                key={`${line.sku || line.productId}-${line.name}`}
                line={line}
                variant="sale"
              />
            ))}
          </div>
        ) : (
          <div className="fin-empty" style={{ padding: 24 }}>No line items</div>
        )}
      </div>
    </DetailModalFrame>
  );
}
