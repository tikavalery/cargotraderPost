import { useEffect, useMemo, useState } from 'react';
import { posApi } from '../../services/posApi';
import { formatXaf } from '../../utils/format';
import { REFUND_METHODS, RETURN_REASONS } from '../../constants/salesReturns';

function lineKey(line, index) {
  return line.sku || line.productId || `line-${index}`;
}

function buildQtyMap(lines, { prefillReturnable = false } = {}) {
  const map = {};
  (lines || []).forEach((line, index) => {
    const key = lineKey(line, index);
    map[key] = prefillReturnable ? line.returnableQty || 0 : 0;
  });
  return map;
}

export default function ProcessSaleReturnModal({
  open,
  transactionId,
  onClose,
  onSuccess,
  showToast
}) {
  const [txn, setTxn] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [qtyMap, setQtyMap] = useState({});
  const [refundMethod, setRefundMethod] = useState('Cash');
  const [reason, setReason] = useState(RETURN_REASONS[0]);

  useEffect(() => {
    if (!open || !transactionId) return;
    setLoading(true);
    setTxn(null);
    posApi
      .getReturnableTransaction(transactionId)
      .then((res) => {
        const data = res.data?.data;
        setTxn(data);
        setRefundMethod(
          REFUND_METHODS.includes(data?.payment) ? data.payment : 'Cash'
        );
        setQtyMap(buildQtyMap(data?.lines, { prefillReturnable: data?.canReturn }));
      })
      .catch((e) => {
        showToast?.(e.response?.data?.message || 'Could not load transaction');
        onClose?.();
      })
      .finally(() => setLoading(false));
  }, [open, transactionId, onClose, showToast]);

  const refundTotal = useMemo(() => {
    if (!txn?.lines) return 0;
    return txn.lines.reduce((sum, line, index) => {
      const key = lineKey(line, index);
      const qty = Number(qtyMap[key]) || 0;
      return sum + qty * (line.price || 0);
    }, 0);
  }, [txn, qtyMap]);

  const setQty = (key, val) => {
    setQtyMap((m) => ({ ...m, [key]: Math.max(0, Number(val) || 0) }));
  };

  const returnAll = () => {
    setQtyMap(buildQtyMap(txn?.lines, { prefillReturnable: true }));
  };

  const selectedQty = useMemo(() => {
    return Object.values(qtyMap).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
  }, [qtyMap]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!txn) return;

    const items = (txn.lines || [])
      .map((line, index) => ({
        sku: line.sku,
        productId: line.productId,
        qty: Number(qtyMap[lineKey(line, index)]) || 0
      }))
      .filter((row) => row.qty > 0);

    if (!items.length) {
      showToast?.('Select at least one item to return');
      return;
    }

    setSaving(true);
    try {
      const res = await posApi.processReturn({
        transactionId: txn.transactionId,
        items,
        refundMethod,
        reason
      });
      window.dispatchEvent(new CustomEvent('afritrade:inventory-changed'));
      showToast?.(res.data?.message || 'Return processed', 'success');
      onSuccess?.(res.data?.data);
      onClose?.();
    } catch (err) {
      showToast?.(err.response?.data?.message || 'Return failed');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="pos-modal-overlay open" onClick={onClose} role="presentation">
      <div className="pos-modal pos-modal-lg" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="pos-modal-header">
          <div>
            <div className="pos-modal-title">Process Return</div>
            <div className="pos-modal-sub">{transactionId}</div>
          </div>
          <button type="button" className="pos-modal-close" onClick={onClose} aria-label="Close">
            <i className="fas fa-times" />
          </button>
        </div>

        <form className="pos-modal-form" onSubmit={handleSubmit}>
          <div className="pos-modal-body">
            {loading && <p className="pos-empty-row">Loading transaction…</p>}

            {!loading && txn && !txn.canReturn && (
              <p className="pos-return-result error">All items on this transaction have already been returned.</p>
            )}

            {!loading && txn?.canReturn && (
              <>
                <div className="pos-return-toolbar">
                  <span className="pos-return-hint">Select quantities to return (partial returns supported)</span>
                  <button type="button" className="pos-btn-outline btn-sm" onClick={returnAll}>
                    Return all remaining
                  </button>
                </div>

                <div className="table-scroll-x">
                  <table className="history-table pos-return-items-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Sold</th>
                        <th>Already returned</th>
                        <th>Return qty</th>
                        <th>Refund</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(txn.lines || []).map((line, index) => {
                        const key = lineKey(line, index);
                        const qty = Number(qtyMap[key]) || 0;
                        const max = line.returnableQty || 0;
                        return (
                          <tr key={key} className={max === 0 ? 'pos-return-row-disabled' : ''}>
                            <td>
                              <div className="pos-return-item-name">{line.name}</div>
                              <div className="pos-return-item-sku">{line.sku}</div>
                            </td>
                            <td>{line.qty}</td>
                            <td>{line.returnedQty || 0}</td>
                            <td>
                              <input
                                type="number"
                                className="pos-return-qty-input"
                                min={0}
                                max={max}
                                value={qty}
                                disabled={max === 0}
                                onChange={(e) => setQty(key, Math.min(max, e.target.value))}
                              />
                            </td>
                            <td>{formatXaf(qty * (line.price || 0))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="pos-return-form-grid">
                  <div className="form-group">
                    <label className="form-label">Refund method</label>
                    <select
                      className="form-select"
                      value={refundMethod}
                      onChange={(e) => setRefundMethod(e.target.value)}
                    >
                      {REFUND_METHODS.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Reason (optional)</label>
                    <select className="form-select" value={reason} onChange={(e) => setReason(e.target.value)}>
                      {RETURN_REASONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pos-return-total">
                  <strong>Refund total:</strong> {formatXaf(refundTotal)}
                </div>
              </>
            )}
          </div>

          <div className="pos-modal-footer">
            <button type="button" className="pos-btn-outline" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="pos-btn-primary"
              disabled={saving || loading || !txn?.canReturn || selectedQty <= 0}
            >
              <i className="fas fa-undo" /> {saving ? 'Processing…' : 'Process Return'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
