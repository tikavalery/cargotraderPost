import { useEffect, useState } from 'react';

const EMPTY = { name: '', city: '', country: '', email: '', phone: '', rating: '4.0' };

function supplierToForm(supplier) {
  if (!supplier) return { ...EMPTY };
  return {
    name: supplier.name || '',
    city: supplier.city || '',
    country: supplier.country || '',
    email: supplier.email || '',
    phone: supplier.phone || '',
    rating: String(supplier.rating ?? 4.0)
  };
}

export default function AddEditSupplierModal({ open, onClose, onSave, saving, supplier = null }) {
  const [form, setForm] = useState(EMPTY);
  const editing = Boolean(supplier);

  useEffect(() => {
    if (open) setForm(supplierToForm(supplier));
  }, [open, supplier]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      rating: Number(form.rating) || 4.0
    });
  };

  return (
    <div className="pur-modal-overlay open" onClick={onClose} role="presentation">
      <div className="pur-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="supplier-form-title">
        <div className="pur-modal-header">
          <div>
            <div id="supplier-form-title" className="pur-modal-title">
              {editing ? 'Edit Supplier' : 'Add New Supplier'}
            </div>
            <div className="pur-modal-sub">
              {editing ? 'Update supplier contact details' : 'Quick-add a supplier to your directory'}
            </div>
          </div>
          <button type="button" className="pur-modal-close" onClick={onClose} aria-label="Close">
            <i className="fas fa-times" />
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="pur-modal-body">
            <div className="form-group" style={{ marginBottom: 14 }}>
              <label className="form-label">
                Supplier Name <span className="req">*</span>
              </label>
              <input
                className="form-input"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">City</label>
                <input
                  className="form-input"
                  placeholder="Guangzhou"
                  value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Country</label>
                <input
                  className="form-input"
                  placeholder="China"
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                />
              </div>
            </div>
            <div className="form-grid-2" style={{ marginTop: 14 }}>
              <div className="form-group">
                <label className="form-label">Email (optional)</label>
                <input
                  type="email"
                  className="form-input"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone (optional)</label>
                <input
                  className="form-input"
                  placeholder="+86 138 0000 0000"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="form-group" style={{ marginTop: 14 }}>
              <label className="form-label">Rating</label>
              <select
                className="form-select"
                value={form.rating}
                onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))}
              >
                {[5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1].map((r) => (
                  <option key={r} value={r}>
                    ★ {r.toFixed(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="pur-modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-save" disabled={saving}>
              <i className={`fas ${editing ? 'fa-check' : 'fa-plus'}`} />
              {editing ? 'Save Changes' : 'Add Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
