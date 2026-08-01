import { useEffect, useState } from 'react';
import { CategorySelectOptions } from '../../theme/inventoryConstants';
import { useT } from '../../i18n/LanguageContext';

const EMPTY = {
  name: '',
  sku: '',
  category: 'Clothes',
  qty: 1,
  location: '',
  purchasePrice: '',
  targetPrice: '',
  purchaseDate: new Date().toISOString().slice(0, 10),
  notes: ''
};

export default function WarehouseStockItemModal({ open, warehouseName, item, onClose, onSave, saving }) {
  const t = useT();
  const [form, setForm] = useState(EMPTY);
  const isEdit = Boolean(item);

  useEffect(() => {
    if (!open) return;
    if (item) {
      setForm({
        name: item.name || '',
        sku: item.sku || '',
        category: item.category || 'Clothes',
        qty: item.qty ?? 1,
        location: item.location || warehouseName || '',
        purchasePrice: item.purchasePrice || '',
        targetPrice: item.targetPrice || '',
        purchaseDate: item.purchaseDate || new Date().toISOString().slice(0, 10),
        notes: item.notes || ''
      });
    } else {
      setForm({ ...EMPTY, location: warehouseName || '' });
    }
  }, [open, item, warehouseName]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="wh-modal-overlay open" style={{ zIndex: 260 }} onClick={onClose} role="presentation">
      <div className="wh-modal wh-modal-lg" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="wh-modal-header">
          <div>
            <div className="wh-modal-title">{isEdit ? 'Edit Item' : 'Add Item'}</div>
            <div className="wh-modal-sub">{warehouseName}</div>
          </div>
          <button type="button" className="wh-modal-close" onClick={onClose}><i className="fas fa-times" /></button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const payload = {
              ...form,
              targetPrice: Number(form.targetPrice) || 0
            };
            // Qty and purchase cost must not change via stock edit — use proper flows.
            if (isEdit) {
              delete payload.qty;
              delete payload.purchasePrice;
              delete payload.purchaseValue;
            } else {
              payload.qty = Number(form.qty) || 1;
              payload.purchasePrice = Number(form.purchasePrice) || 0;
            }
            onSave(payload);
          }}
        >
          <div className="wh-modal-body">
            <label className="form-label">Item Name *</label>
            <input className="form-input" value={form.name} onChange={set('name')} required />
            <div className="form-grid-2">
              <div>
                <label className="form-label">SKU</label>
                <input className="form-input" value={form.sku} onChange={set('sku')} />
              </div>
              <div>
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category} onChange={set('category')}>
                  <CategorySelectOptions />
                </select>
              </div>
            </div>
            <div className="form-grid-2">
              <div>
                <label className="form-label">Qty</label>
                <input
                  type="number"
                  min="1"
                  className="form-input"
                  value={form.qty}
                  onChange={set('qty')}
                  disabled={isEdit}
                  readOnly={isEdit}
                  title={isEdit ? 'Quantity cannot be edited here — use transfers, sales, or returns' : undefined}
                />
                {isEdit && (
                  <p style={{ marginTop: 6, fontSize: 11, color: 'var(--text-light)' }}>
                    {t('Quantity is locked. Adjust stock via transfers, sales, or returns.')}
                  </p>
                )}
              </div>
              <div>
                <label className="form-label">Location</label>
                <input className="form-input" value={form.location} onChange={set('location')} />
              </div>
            </div>
            <div className="form-grid-2">
              <div>
                <label className="form-label">{t('Purchase Price')} (XAF)</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.purchasePrice}
                  onChange={set('purchasePrice')}
                  disabled={isEdit}
                  readOnly={isEdit}
                  title={
                    isEdit
                      ? t('Purchase price cannot be edited here — edit the purchase so Finance stays in sync')
                      : undefined
                  }
                />
                {isEdit && (
                  <p style={{ marginTop: 6, fontSize: 11, color: 'var(--text-light)' }}>
                    {t('Purchase price is locked. Change cost from All Purchases so Expenses stay in sync.')}
                  </p>
                )}
              </div>
              <div>
                <label className="form-label">{t('Target Price')} (XAF)</label>
                <input type="number" className="form-input" value={form.targetPrice} onChange={set('targetPrice')} />
              </div>
            </div>
            <label className="form-label">Purchased</label>
            <input type="date" className="form-input" value={form.purchaseDate} onChange={set('purchaseDate')} />
            <label className="form-label">Notes</label>
            <textarea className="form-input" rows={2} value={form.notes} onChange={set('notes')} />
          </div>
          <div className="wh-modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary-green" disabled={saving}>
              <i className="fas fa-check" /> {isEdit ? 'Save Changes' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
