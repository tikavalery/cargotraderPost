import { useEffect, useState } from 'react';

const EMPTY = {
  name: '',
  address: '',
  city: '',
  manager: '',
  phone: '',
  shelfTarget: 100
};

export default function AddEditStoreModal({ open, store, onClose, onSave, saving }) {
  const [form, setForm] = useState(EMPTY);
  const isEdit = Boolean(store);

  useEffect(() => {
    if (!open) return;
    if (store) {
      setForm({
        name: store.name || '',
        address: store.address?.split(',')[0]?.trim() || store.address || '',
        city: store.city || '',
        manager: store.manager === '—' ? '' : store.manager || '',
        phone: store.phone || '',
        shelfTarget: store.shelfTarget || 100
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, store]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="wh-modal-overlay open" onClick={onClose} role="presentation">
      <div className="wh-modal wh-modal-lg" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="wh-modal-header">
          <div>
            <div className="wh-modal-title">{isEdit ? 'Edit Store' : 'Add New Store'}</div>
            <div className="wh-modal-sub">
              {isEdit ? 'Update store location and contact details' : 'Register a new retail location'}
            </div>
          </div>
          <button type="button" className="wh-modal-close" onClick={onClose} aria-label="Close">
            <i className="fas fa-times" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(form);
          }}
        >
          <div className="wh-modal-body">
            <label className="form-label">Store Name *</label>
            <input
              className="form-input"
              placeholder="ThriftShop Yaoundé"
              value={form.name}
              onChange={set('name')}
              required
            />
            <label className="form-label">Address</label>
            <input
              className="form-input"
              placeholder="Avenue Kennedy"
              value={form.address}
              onChange={set('address')}
            />
            <div className="form-grid-2">
              <div>
                <label className="form-label">City</label>
                <input
                  className="form-input"
                  placeholder="Yaoundé"
                  value={form.city}
                  onChange={set('city')}
                />
              </div>
              <div>
                <label className="form-label">Shelf Target (units)</label>
                <input
                  type="number"
                  min="10"
                  className="form-input"
                  value={form.shelfTarget}
                  onChange={set('shelfTarget')}
                />
              </div>
            </div>
            <div className="form-grid-2">
              <div>
                <label className="form-label">Manager</label>
                <input className="form-input" value={form.manager} onChange={set('manager')} />
              </div>
              <div>
                <label className="form-label">Phone</label>
                <input className="form-input" value={form.phone} onChange={set('phone')} />
              </div>
            </div>
          </div>
          <div className="wh-modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-add" disabled={saving}>
              {saving ? (
                <>
                  <i className="fas fa-spinner fa-spin" /> Saving…
                </>
              ) : isEdit ? (
                'Save Changes'
              ) : (
                'Add Store'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
