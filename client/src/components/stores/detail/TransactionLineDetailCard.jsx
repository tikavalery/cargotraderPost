import { categoryMeta } from '../../../theme/inventoryConstants';
import { formatXaf } from '../../../utils/format';
import PosProductThumb from '../PosProductThumb';

export default function TransactionLineDetailCard({ line, variant = 'sale' }) {
  if (!line) return null;

  const meta = categoryMeta(line.category);
  const qty = variant === 'return' ? line.quantityReturned ?? line.qty : line.qty;
  const unitPrice = variant === 'return' ? line.unitPrice ?? line.price : line.price;
  const lineTotal =
    variant === 'return'
      ? line.totalAmount ?? (unitPrice || 0) * (qty || 0)
      : (unitPrice || 0) * (qty || 0);

  const qtyLabel = variant === 'return' ? 'returned' : 'sold';
  const categoryLabel = line.category || line.catLabel || '—';

  return (
    <div className="pos-txn-line">
      <div
        className="pos-txn-line-thumb"
        style={{ background: line.image ? 'var(--bg)' : `${line.color || meta.color || '#E8ECF0'}22` }}
      >
        <PosProductThumb
          image={line.image}
          icon={line.icon || meta.icon}
          color={line.color || meta.color}
          className="pos-txn-line-photo"
          iconClassName="pos-txn-line-icon"
        />
      </div>
      <div className="pos-txn-line-info">
        <div className="pos-txn-line-name" title={line.name}>
          {line.name || 'Item'}
        </div>
        <div className="pos-txn-line-meta">
          <span>{line.sku || '—'}</span>
          <span className="pos-txn-line-meta-sep">·</span>
          <span>{categoryLabel}</span>
          {variant === 'sale' && (line.returnedQty || 0) > 0 && (
            <>
              <span className="pos-txn-line-meta-sep">·</span>
              <span className="pos-txn-line-returned">{line.returnedQty} returned</span>
            </>
          )}
        </div>
        <div className="pos-txn-line-pricing">
          <span>
            {formatXaf(unitPrice)} × {qty ?? 0} {qtyLabel}
          </span>
        </div>
      </div>
      <div className="pos-txn-line-total">{formatXaf(lineTotal)}</div>
    </div>
  );
}
