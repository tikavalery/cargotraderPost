import { useEffect, useState } from 'react';
import { storesApi } from '../../services/posApi';
import { warehousesApi } from '../../api';
import { STORE_CLERK_ROLE, WAREHOUSE_WORKER_ROLE } from '../../utils/permissions';

function warehouseKey(wh) {
  return String(wh._id || wh.id || '');
}

export default function EditStaffModal({ open, record, type, roles, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    name: '',
    role: '',
    isActive: true,
    assignedStoreId: '',
    assignedWarehouseIds: []
  });
  const [stores, setStores] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  useEffect(() => {
    if (!open) return;
    storesApi
      .list({ lite: '1' })
      .then((res) => setStores((res.data?.data || []).filter((s) => s.active !== false)))
      .catch(() => setStores([]));
    warehousesApi
      .list()
      .then((res) => setWarehouses(res.data?.warehouses || []))
      .catch(() => setWarehouses([]));
  }, [open]);

  useEffect(() => {
    if (!record) return;
    setForm({
      name: record.name || '',
      role: record.role || roles[0] || 'Store Clerk',
      isActive: record.isActive !== false,
      assignedStoreId: record.assignedStoreId || '',
      assignedWarehouseIds: record.assignedWarehouseIds || []
    });
  }, [record, roles]);

  if (!open || !record) return null;

  const isInvite = type === 'invitation';

  const toggleWarehouse = (id) => {
    setForm((f) => ({
      ...f,
      assignedWarehouseIds: f.assignedWarehouseIds.includes(id)
        ? f.assignedWarehouseIds.filter((w) => w !== id)
        : [...f.assignedWarehouseIds, id]
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (form.role === STORE_CLERK_ROLE && !form.assignedStoreId) return;
    if (form.role === WAREHOUSE_WORKER_ROLE && !form.assignedWarehouseIds.length) return;
    if (isInvite) {
      onSave({
        role: form.role,
        assignedStoreId: form.role === STORE_CLERK_ROLE ? form.assignedStoreId : '',
        assignedWarehouseIds: form.role === WAREHOUSE_WORKER_ROLE ? form.assignedWarehouseIds : []
      });
    } else {
      onSave({
        name: form.name.trim(),
        role: form.role,
        isActive: form.isActive,
        assignedStoreId: form.role === STORE_CLERK_ROLE ? form.assignedStoreId : '',
        assignedWarehouseIds: form.role === WAREHOUSE_WORKER_ROLE ? form.assignedWarehouseIds : []
      });
    }
  };

  return (
    <div className="inv-modal-overlay open settings-staff-modal" onClick={onClose} role="presentation">
      <div className="inv-modal" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="inv-modal-header">
          <div>
            <div className="inv-modal-title">{isInvite ? 'Edit invitation' : 'Edit team member'}</div>
            <div className="inv-modal-sub">
              {isInvite ? record.email || record.phone : record.name}
            </div>
          </div>
          <button type="button" className="inv-modal-close" onClick={onClose} aria-label="Close">
            <i className="fas fa-times" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="inv-modal-body">
            {!isInvite && (
              <div className="form-group">
                <label className="form-label" htmlFor="edit-staff-name">Full name</label>
                <input
                  id="edit-staff-name"
                  type="text"
                  className="form-input"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
            )}
            <div className="form-group">
              <label className="form-label" htmlFor="edit-staff-role">Role</label>
              <select
                id="edit-staff-role"
                className="form-select"
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              >
                {roles.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            {form.role === STORE_CLERK_ROLE && (
              <div className="form-group">
                <label className="form-label" htmlFor="edit-staff-store">Assigned store</label>
                <select
                  id="edit-staff-store"
                  className="form-select"
                  value={form.assignedStoreId}
                  onChange={(e) => setForm((f) => ({ ...f, assignedStoreId: e.target.value }))}
                  required
                >
                  <option value="">Select store…</option>
                  {stores.map((s) => (
                    <option key={s.storeId} value={s.storeId}>{s.name}{s.city ? ` — ${s.city}` : ''}</option>
                  ))}
                </select>
              </div>
            )}
            {form.role === WAREHOUSE_WORKER_ROLE && (
              <div className="form-group">
                <span className="form-label">Assigned warehouses</span>
                {warehouses.length === 0 ? (
                  <p className="form-hint">No warehouses available.</p>
                ) : (
                  <div className="settings-warehouse-checklist">
                    {warehouses.map((wh) => {
                      const key = warehouseKey(wh);
                      return (
                      <label key={key} className="settings-check-row">
                        <input
                          type="checkbox"
                          checked={form.assignedWarehouseIds.includes(key)}
                          onChange={() => toggleWarehouse(key)}
                        />
                        <span>{wh.name}{wh.location ? ` — ${wh.location}` : ''}</span>
                      </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {!isInvite && (
              <div className="form-group">
                <label className="form-label">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                    style={{ marginRight: 8 }}
                  />
                  Account active
                </label>
              </div>
            )}
          </div>
          <div className="inv-modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <><i className="fas fa-spinner fa-spin" /> Saving…</> : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
