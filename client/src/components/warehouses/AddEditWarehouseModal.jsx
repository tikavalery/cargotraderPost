import { useEffect, useState } from 'react';

const EMPTY = { name: '', address: '', country: 'Cameroon', capacityM3: 200, manager: '', phone: '' };

const COUNTRIES = ['Cameroon', 'Nigeria', 'Ghana', 'UAE'];

export default function AddEditWarehouseModal({ open, warehouse, onClose, onSave, saving }) {
  const [form, setForm] = useState(EMPTY);
  const isEdit = Boolean(warehouse);

  useEffect(() => {
    if (!open) return;
    if (warehouse) {
      setForm({
        name: warehouse.name || '',
        address: warehouse.address || '',
        country: warehouse.country || 'Cameroon',
        capacityM3: warehouse.capacityM3 || 200,
        manager: warehouse.manager || '',
        phone: warehouse.phone || ''
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, warehouse]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className={`wh-modal-overlay open`} onClick={onClose} role="presentation">
      <div className="wh-modal" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="wh-modal-header">
          <div>
            <div className="wh-modal-title">{isEdit ? 'Edit Warehouse' : 'Add New Warehouse'}</div>
            <div className="wh-modal-sub">{isEdit ? 'Update warehouse details' : 'Register a new storage location'}</div>
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
            <label className="form-label">Warehouse Name *</label>
            <input className="form-input" placeholder="Warehouse E — Kribi Depot" value={form.name} onChange={set('name')} required />
            <label className="form-label">Address</label>
            <input className="form-input" placeholder="Street, City" value={form.address} onChange={set('address')} />
            {!isEdit && (
              <>
                <label className="form-label">Country</label>
                <select className="form-select" value={form.country} onChange={set('country')}>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </>
            )}
            <div className="form-grid-2">
              <div>
                <label className="form-label">Capacity (m³)</label>
                <input type="number" min="50" className="form-input" value={form.capacityM3} onChange={set('capacityM3')} />
              </div>
              <div>
                <label className="form-label">Manager</label>
                <input className="form-input" value={form.manager} onChange={set('manager')} />
              </div>
            </div>
            <label className="form-label">Phone</label>
            <input className="form-input" placeholder="+237 …" value={form.phone} onChange={set('phone')} />
          </div>
          <div className="wh-modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary-green" disabled={saving}>
              <i className="fas fa-check" /> {isEdit ? 'Save Changes' : 'Save Warehouse'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
