import { useEffect, useState } from 'react';
import { EXPENSE_CATEGORY_GROUPS, OPERATING_EXPENSE_CATEGORIES, resolveExpenseCategory, REVENUE_SOURCES } from '../../constants/financeConstants';
import { CURRENCY_OPTIONS } from '../../theme/authConstants';
import { formatXaf } from '../../utils/format';
import { groupDigits } from '../../utils/numberFormat';
import ExpenseAiReceiptSection from './ExpenseAiReceiptSection';
import { applyAiToExpenseForm } from '../../utils/expenseAi';
import { resolvePhotosForSave, mediaSrc } from '../../utils/cloudinaryUpload';
import { useToast } from '../../context/ToastContext';

const EMPTY_REVENUE = {
  date: new Date().toISOString().slice(0, 10),
  source: REVENUE_SOURCES[0],
  description: '',
  amount: '',
  currency: 'XAF',
  reference: ''
};

function revenueToForm(record) {
  if (!record) return { ...EMPTY_REVENUE, date: new Date().toISOString().slice(0, 10) };
  return {
    date: record.date ? new Date(record.date).toISOString().slice(0, 10) : EMPTY_REVENUE.date,
    source: record.source || REVENUE_SOURCES[0],
    description: record.description || '',
    amount: record.amount != null ? String(record.amount) : '',
    currency: record.currency || 'XAF',
    reference: record.reference || ''
  };
}

function formatViewDate(date) {
  if (!date) return '—';
  return new Date(date).toISOString().slice(0, 10);
}

function formatViewAmount(amount, currency) {
  const n = Number(amount) || 0;
  if (currency === 'XAF') return groupDigits(n);
  if (currency === 'EUR') return `€${groupDigits(n, { maximumFractionDigits: 2 })}`;
  return `$${groupDigits(n, { maximumFractionDigits: 2 })}`;
}

function RevenueProductsList({ products, currency }) {
  if (!products?.length) return null;
  return (
    <div className="fin-revenue-products">
      {products.map((p, i) => (
        <div key={`${p.sku || p.name}-${i}`} className="fin-revenue-product-row">
          <div className="fin-revenue-product-info">
            <div className="fin-revenue-product-name">{p.name || p.sku || 'Item'}</div>
            <div className="fin-revenue-product-meta">
              {p.sku ? <span>{p.sku}</span> : null}
              {p.category ? <span>{p.category}</span> : null}
              <span>× {p.qty ?? 1}</span>
            </div>
          </div>
          <div className="fin-revenue-product-pricing">
            <div className="fin-revenue-product-unit">{formatViewAmount(p.unitPrice, currency)} each</div>
            <div className="fin-revenue-product-total">
              {formatViewAmount(p.lineTotal ?? (p.unitPrice || 0) * (p.qty || 1), currency)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function RecordRevenueModal({ open, onClose, onSubmit, saving = false, mode = 'create', record = null }) {
  const isView = mode === 'view';
  const isEdit = mode === 'edit';
  const [form, setForm] = useState(EMPTY_REVENUE);

  useEffect(() => {
    if (open) {
      setForm(isView ? EMPTY_REVENUE : revenueToForm(record));
    }
  }, [open, record, isView]);

  if (!open) return null;

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      date: form.date,
      source: form.source,
      description: form.description.trim(),
      amount: Number(form.amount),
      currency: form.currency,
      reference: form.reference.trim()
    });
  };

  const handleClose = () => {
    setForm(EMPTY_REVENUE);
    onClose();
  };

  const title = isView ? 'Revenue Details' : isEdit ? 'Edit Revenue' : 'Record Revenue';
  const subtitle = isView
    ? (record?.auto ? 'Auto-synced from another module' : 'Manually recorded entry')
    : 'POS, marketplace, wholesale, shipment sales, and manual entries';

  return (
    <div className="pos-modal-overlay open" onClick={handleClose} role="presentation">
      <div className="pos-modal fin-expense-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="record-revenue-title">
        <div className="pos-modal-header">
          <div>
            <div className="pos-modal-title" id="record-revenue-title">{title}</div>
            <p className="fin-modal-sub">{subtitle}</p>
          </div>
          <button type="button" className="pos-modal-close" onClick={handleClose} aria-label="Close"><i className="fas fa-times" /></button>
        </div>
        {isView ? (
          <>
            <div className="pos-modal-body fin-form">
              <div className="fin-view-grid">
                <div>
                  <div className="fin-view-field-label">Date</div>
                  <div className="fin-view-value">{formatViewDate(record?.date)}</div>
                </div>
                <div>
                  <div className="fin-view-field-label">Source</div>
                  <div className="fin-view-value">{record?.source || '—'}</div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div className="fin-view-field-label">Description</div>
                  <div className="fin-view-value">{record?.description || '—'}</div>
                </div>
                {record?.products?.length > 0 && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div className="fin-view-field-label">Products sold</div>
                    <RevenueProductsList products={record.products} currency={record.currency} />
                  </div>
                )}
                <div>
                  <div className="fin-view-field-label">Amount</div>
                  <div className="fin-view-value">
                    {record?.amountXaf != null ? formatXaf(record.amountXaf) : formatViewAmount(record?.amount, record?.currency)}
                  </div>
                </div>
                <div>
                  <div className="fin-view-field-label">Status</div>
                  <div className="fin-view-value">{record?.status || '—'}</div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div className="fin-view-field-label">Reference</div>
                  <div className="fin-view-value">{record?.reference || '—'}</div>
                </div>
              </div>
            </div>
            <div className="pos-modal-footer">
              <button type="button" className="pos-btn-outline" onClick={handleClose}>Close</button>
            </div>
          </>
        ) : (
          <form className="pos-modal-form" onSubmit={handleSubmit}>
            <div className="pos-modal-body fin-form">
              <div className="form-grid-2">
                <label className="fin-field">
                  <span className="fin-field-label">Date</span>
                  <input type="date" name="date" value={form.date} onChange={set('date')} required className="fin-input" />
                </label>
                <label className="fin-field">
                  <span className="fin-field-label">Source</span>
                  <select name="source" value={form.source} onChange={set('source')} required className="fin-input">
                    {REVENUE_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </label>
              </div>
              <label className="fin-field">
                <span className="fin-field-label">Description</span>
                <input name="description" value={form.description} onChange={set('description')} required className="fin-input" placeholder="e.g. Marketplace order payout" />
              </label>
              <div className="form-grid-2">
                <label className="fin-field">
                  <span className="fin-field-label">Amount</span>
                  <input type="number" name="amount" value={form.amount} onChange={set('amount')} required min="0.01" step="0.01" className="fin-input" placeholder="0" />
                </label>
                <label className="fin-field">
                  <span className="fin-field-label">Currency</span>
                  <select name="currency" value={form.currency} onChange={set('currency')} className="fin-input">
                    {CURRENCY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code}>{c.code}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="fin-field">
                <span className="fin-field-label">Reference</span>
                <input name="reference" value={form.reference} onChange={set('reference')} className="fin-input" placeholder="Invoice, order, or transaction #" />
              </label>
            </div>
            <div className="pos-modal-footer">
              <button type="button" className="pos-btn-outline" onClick={handleClose} disabled={saving}>Cancel</button>
              <button type="submit" className="btn-fin-revenue" disabled={saving}>
                {saving
                  ? <><i className="fas fa-spinner fa-spin" /> Saving…</>
                  : isEdit
                    ? <><i className="fas fa-save" /> Save Changes</>
                    : <><i className="fas fa-plus-circle" /> Save Revenue</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const EMPTY_EXPENSE = {
  date: new Date().toISOString().slice(0, 10),
  category: OPERATING_EXPENSE_CATEGORIES[0],
  description: '',
  amount: '',
  currency: 'XAF',
  reference: '',
  shipmentId: '',
  receipts: []
};

function expenseToForm(record) {
  if (!record) return { ...EMPTY_EXPENSE, date: new Date().toISOString().slice(0, 10), receipts: [] };
  return {
    date: record.date ? new Date(record.date).toISOString().slice(0, 10) : EMPTY_EXPENSE.date,
    category: resolveExpenseCategory(record.category) || OPERATING_EXPENSE_CATEGORIES[0],
    description: record.description || '',
    amount: record.amount != null ? String(record.amount) : '',
    currency: record.currency || 'XAF',
    reference: record.reference || '',
    shipmentId: record.shipmentId || '',
    receipts: Array.isArray(record.receipts) ? [...record.receipts] : []
  };
}

export function RecordExpenseModal({ open, onClose, onSubmit, saving = false, mode = 'create', record = null }) {
  const isView = mode === 'view';
  const isEdit = mode === 'edit';
  const { showToast } = useToast();
  const [form, setForm] = useState(EMPTY_EXPENSE);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(isView ? EMPTY_EXPENSE : expenseToForm(record));
      setUploading(false);
    }
  }, [open, record, isView]);

  if (!open) return null;

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  const receiptList = Array.isArray(record?.receipts) ? record.receipts.filter(Boolean) : [];
  const busy = saving || uploading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);
    try {
      const receipts = await resolvePhotosForSave(form.receipts || []);
      await onSubmit({
        date: form.date,
        category: form.category,
        description: form.description.trim(),
        amount: Number(form.amount),
        currency: form.currency,
        reference: form.reference.trim(),
        shipmentId: form.shipmentId.trim(),
        receipts
      });
    } catch (err) {
      showToast(err.message || 'Could not upload receipt images');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setForm({ ...EMPTY_EXPENSE, receipts: [] });
    onClose();
  };

  const title = isView ? 'Expense Details' : isEdit ? 'Edit Expense' : 'Record Expense';
  const subtitle = isView
    ? (record?.auto ? 'Auto-synced from another module' : 'Manually recorded entry')
    : 'Freight, duties, rent, wages, and operating costs';

  return (
    <div className="pos-modal-overlay open" onClick={handleClose} role="presentation">
      <div className="pos-modal fin-expense-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="record-expense-title">
        <div className="pos-modal-header">
          <div>
            <div className="pos-modal-title" id="record-expense-title">{title}</div>
            <p className="fin-modal-sub">{subtitle}</p>
          </div>
          <button type="button" className="pos-modal-close" onClick={handleClose} aria-label="Close"><i className="fas fa-times" /></button>
        </div>
        {isView ? (
          <>
            <div className="pos-modal-body fin-form">
              <div className="fin-view-grid">
                <div>
                  <div className="fin-view-field-label">Date</div>
                  <div className="fin-view-value">{formatViewDate(record?.date)}</div>
                </div>
                <div>
                  <div className="fin-view-field-label">Category</div>
                  <div className="fin-view-value">{record?.category || '—'}</div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div className="fin-view-field-label">Description</div>
                  <div className="fin-view-value">{record?.description || '—'}</div>
                </div>
                <div>
                  <div className="fin-view-field-label">Amount</div>
                  <div className="fin-view-value">
                    {record?.amountXaf != null ? formatXaf(record.amountXaf) : formatViewAmount(record?.amount, record?.currency)}
                  </div>
                </div>
                <div>
                  <div className="fin-view-field-label">Status</div>
                  <div className="fin-view-value">{record?.status || '—'}</div>
                </div>
                <div>
                  <div className="fin-view-field-label">Related</div>
                  <div className="fin-view-value">{record?.relatedTo || record?.shipmentId || record?.reference || '—'}</div>
                </div>
                <div>
                  <div className="fin-view-field-label">Source</div>
                  <div className="fin-view-value">{record?.source || '—'}</div>
                </div>
              </div>
              <div className="fin-receipt-view">
                <div className="fin-view-field-label">Receipts</div>
                {receiptList.length ? (
                  <div className="fin-receipt-gallery">
                    {receiptList.map((src, i) => (
                      <a
                        key={`${i}-${String(src).slice(0, 24)}`}
                        className="fin-receipt-gallery-item"
                        href={mediaSrc(src)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open receipt"
                      >
                        <img src={mediaSrc(src)} alt={`Receipt ${i + 1}`} />
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="fin-view-value">No receipts attached</div>
                )}
              </div>
            </div>
            <div className="pos-modal-footer">
              <button type="button" className="pos-btn-outline" onClick={handleClose}>Close</button>
            </div>
          </>
        ) : (
          <form className="pos-modal-form" onSubmit={handleSubmit}>
            <div className="pos-modal-body fin-form">
              <div className="form-grid-2">
                <label className="fin-field">
                  <span className="fin-field-label">Date</span>
                  <input type="date" name="date" value={form.date} onChange={set('date')} required className="fin-input" />
                </label>
                <label className="fin-field">
                  <span className="fin-field-label">Category</span>
                  <select name="category" value={form.category} onChange={set('category')} required className="fin-input">
                    {EXPENSE_CATEGORY_GROUPS.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.options.map((c) => <option key={c} value={c}>{c}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </label>
              </div>
              <label className="fin-field">
                <span className="fin-field-label">Description</span>
                <input name="description" value={form.description} onChange={set('description')} required className="fin-input" placeholder="e.g. Douala port freight charges" />
              </label>
              <div className="form-grid-2">
                <label className="fin-field">
                  <span className="fin-field-label">Amount</span>
                  <input type="number" name="amount" value={form.amount} onChange={set('amount')} required min="0.01" step="0.01" className="fin-input" placeholder="0" />
                </label>
                <label className="fin-field">
                  <span className="fin-field-label">Currency</span>
                  <select name="currency" value={form.currency} onChange={set('currency')} className="fin-input">
                    {CURRENCY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.code}>{c.code}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="form-grid-2">
                <label className="fin-field">
                  <span className="fin-field-label">Reference</span>
                  <input name="reference" value={form.reference} onChange={set('reference')} className="fin-input" placeholder="Invoice or PO #" />
                </label>
                <label className="fin-field">
                  <span className="fin-field-label">Shipment ID</span>
                  <input name="shipmentId" value={form.shipmentId} onChange={set('shipmentId')} className="fin-input" placeholder="Optional SHP-xxx" />
                </label>
              </div>
              <ExpenseAiReceiptSection
                photos={form.receipts || []}
                onPhotosChange={(receipts) => setForm((prev) => ({ ...prev, receipts }))}
                onAnalysisApply={(data) => setForm((prev) => applyAiToExpenseForm(prev, data))}
              />
            </div>
            <div className="pos-modal-footer">
              <button type="button" className="pos-btn-outline" onClick={handleClose} disabled={busy}>Cancel</button>
              <button type="submit" className="btn-record-expense" disabled={busy}>
                {busy
                  ? <><i className="fas fa-spinner fa-spin" /> {uploading ? 'Uploading…' : 'Saving…'}</>
                  : isEdit
                    ? <><i className="fas fa-save" /> Save Changes</>
                    : <><i className="fas fa-minus-circle" /> Save Expense</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function ViewCashFlowModal({ open, onClose, record = null }) {
  if (!open || !record) return null;

  const isRevenue = record.type === 'revenue';
  const amountDisplay = record.amountFmt
    || (record.amountXaf != null ? formatXaf(Math.abs(record.amountXaf)) : formatViewAmount(record.amount, record.currency));

  return (
    <div className="pos-modal-overlay open" onClick={onClose} role="presentation">
      <div className="pos-modal fin-expense-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="cashflow-view-title">
        <div className="pos-modal-header">
          <div>
            <div className="pos-modal-title" id="cashflow-view-title">Cash Flow Entry</div>
            <p className="fin-modal-sub">{record.auto ? 'Auto-synced ledger entry' : 'Manually recorded entry'}</p>
          </div>
          <button type="button" className="pos-modal-close" onClick={onClose} aria-label="Close"><i className="fas fa-times" /></button>
        </div>
        <div className="pos-modal-body fin-form">
          <div className="fin-view-grid">
            <div>
              <div className="fin-view-field-label">Type</div>
              <div className={`fin-view-value ${isRevenue ? 'profit-pos' : 'profit-neg'}`}>{isRevenue ? 'Revenue' : 'Expense'}</div>
            </div>
            <div>
              <div className="fin-view-field-label">Date</div>
              <div className="fin-view-value">{formatViewDate(record.date)}</div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="fin-view-field-label">Description</div>
              <div className="fin-view-value">{record.description || '—'}</div>
            </div>
            <div>
              <div className="fin-view-field-label">Source</div>
              <div className="fin-view-value">{record.source || '—'}</div>
            </div>
            <div>
              <div className="fin-view-field-label">Category</div>
              <div className="fin-view-value">{record.category || '—'}</div>
            </div>
            <div>
              <div className="fin-view-field-label">Amount</div>
              <div className={`fin-view-value ${isRevenue ? 'profit-pos' : 'profit-neg'}`}>
                {amountDisplay.startsWith('+') || amountDisplay.startsWith('−') || amountDisplay.startsWith('-')
                  ? amountDisplay
                  : `${isRevenue ? '+' : '−'}${amountDisplay}`}
              </div>
            </div>
            <div>
              <div className="fin-view-field-label">Status</div>
              <div className="fin-view-value">{record.status || '—'}</div>
            </div>
            {record.reference ? (
              <div style={{ gridColumn: '1 / -1' }}>
                <div className="fin-view-field-label">Reference</div>
                <div className="fin-view-value">{record.reference}</div>
              </div>
            ) : null}
          </div>
        </div>
        <div className="pos-modal-footer">
          <button type="button" className="pos-btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
