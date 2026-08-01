import { useEffect, useState } from 'react';
import { staffApi } from '../../services/staffApi';
import { storesApi } from '../../services/posApi';
import { warehousesApi } from '../../api';
import { STORE_CLERK_ROLE, WAREHOUSE_WORKER_ROLE } from '../../utils/permissions';

function InviteSuccessPanel({ inviteUrl, message, onDone }) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* fallback: user can select the input */
    }
  };

  return (
    <div className="inv-modal-body">
      <div className="settings-invite-success">
        <i className="fas fa-check-circle" />
        <p>{message}</p>
        {inviteUrl && (
          <div className="settings-invite-link-box">
            <label className="form-label" htmlFor="invite-link-copy">Registration link</label>
            <div className="settings-invite-link-row">
              <input id="invite-link-copy" className="form-input" readOnly value={inviteUrl} onFocus={(e) => e.target.select()} />
              <button type="button" className="btn-secondary" onClick={copyLink}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="form-hint">Send this link so they can set their password and join.</p>
          </div>
        )}
      </div>
      <div className="inv-modal-footer" style={{ margin: '0 -20px -18px', paddingTop: 12 }}>
        <button type="button" className="btn-primary" onClick={onDone}>Done</button>
      </div>
    </div>
  );
}

function warehouseKey(wh) {
  return String(wh._id || wh.id || '');
}

export default function InviteUserModal({ open, roles, onClose, onInvited, atUserLimit = false }) {
  const [identifier, setIdentifier] = useState('');
  const [role, setRole] = useState(roles[0] || 'Store Clerk');
  const [assignedStoreId, setAssignedStoreId] = useState('');
  const [assignedWarehouseIds, setAssignedWarehouseIds] = useState([]);
  const [stores, setStores] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    if (!open) return;
    storesApi
      .list({ lite: '1' })
      .then((res) => {
        const list = (res.data?.data || []).filter((s) => s.active !== false);
        setStores(list);
        if (list.length) setAssignedStoreId((prev) => prev || list[0].storeId);
      })
      .catch(() => setStores([]));
    warehousesApi
      .list()
      .then((res) => {
        const list = res.data?.warehouses || [];
        setWarehouses(list);
        if (list.length) {
          setAssignedWarehouseIds((prev) => (prev.length ? prev : [warehouseKey(list[0])]));
        }
      })
      .catch(() => setWarehouses([]));
  }, [open]);

  if (!open) return null;

  const handleClose = () => {
    setError('');
    setSuccess(null);
    setIdentifier('');
    setRole(roles[0] || 'Store Clerk');
    setAssignedStoreId('');
    setAssignedWarehouseIds([]);
    onClose();
  };

  const toggleWarehouse = (id) => {
    setAssignedWarehouseIds((prev) =>
      prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (atUserLimit) {
      setError('User limit reached on your plan. Upgrade or remove a user to invite more.');
      return;
    }
    if (!identifier.trim()) {
      setError('Enter an email or phone number');
      return;
    }
    if (role === STORE_CLERK_ROLE && !assignedStoreId) {
      setError('Select a store for this clerk');
      return;
    }
    if (role === WAREHOUSE_WORKER_ROLE && !assignedWarehouseIds.length) {
      setError('Select at least one warehouse for this worker');
      return;
    }
    setLoading(true);
    try {
      const res = await staffApi.invite({
        identifier: identifier.trim(),
        role,
        assignedStoreId: role === STORE_CLERK_ROLE ? assignedStoreId : '',
        assignedWarehouseIds: role === WAREHOUSE_WORKER_ROLE ? assignedWarehouseIds : []
      });
      const payload = res.data;
      if (payload.emailSent) {
        onInvited(payload);
        handleClose();
      } else {
        setSuccess(payload);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    if (success) onInvited(success);
    handleClose();
  };

  return (
    <div className="inv-modal-overlay open settings-staff-modal" onClick={handleClose} role="presentation">
      <div className="inv-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="invite-title">
        <div className="inv-modal-header">
          <div>
            <div className="inv-modal-title" id="invite-title">
              {success ? 'Invitation created' : 'Invite team member'}
            </div>
            <div className="inv-modal-sub">
              {success
                ? 'Share the link with your new team member'
                : 'They will receive a link to set their password and join your business'}
            </div>
          </div>
          <button type="button" className="inv-modal-close" onClick={handleClose} aria-label="Close">
            <i className="fas fa-times" />
          </button>
        </div>

        {success ? (
          <InviteSuccessPanel inviteUrl={success.inviteUrl} message={success.message} onDone={handleDone} />
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="inv-modal-body">
              {error && (
                <div className="settings-form-error" role="alert">{error}</div>
              )}
              <div className="form-group">
                <label className="form-label" htmlFor="invite-identifier">Email or phone</label>
                <input
                  id="invite-identifier"
                  type="text"
                  className="form-input"
                  placeholder="name@company.com or +237 6XX XXX XXX"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="invite-role">Role</label>
                <select
                  id="invite-role"
                  className="form-select"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  {roles.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <p className="form-hint">
                  <i className="fas fa-info-circle" />
                  Roles control what each user can access across inventory, sales, finance, and warehouses.
                </p>
              </div>
              {role === STORE_CLERK_ROLE && (
                <div className="form-group">
                  <label className="form-label" htmlFor="invite-store">Assigned store</label>
                  <select
                    id="invite-store"
                    className="form-select"
                    value={assignedStoreId}
                    onChange={(e) => setAssignedStoreId(e.target.value)}
                    required
                  >
                    {stores.length === 0 && <option value="">No stores available</option>}
                    {stores.map((s) => (
                      <option key={s.storeId} value={s.storeId}>{s.name}{s.city ? ` — ${s.city}` : ''}</option>
                    ))}
                  </select>
                  <p className="form-hint">Clerks only see inventory and POS for this store.</p>
                </div>
              )}
              {role === WAREHOUSE_WORKER_ROLE && (
                <div className="form-group">
                  <span className="form-label">Assigned warehouses</span>
                  {warehouses.length === 0 ? (
                    <p className="form-hint">No warehouses available — create warehouses first.</p>
                  ) : (
                    <div className="settings-warehouse-checklist">
                      {warehouses.map((wh) => {
                        const key = warehouseKey(wh);
                        return (
                        <label key={key} className="settings-check-row">
                          <input
                            type="checkbox"
                            checked={assignedWarehouseIds.includes(key)}
                            onChange={() => toggleWarehouse(key)}
                          />
                          <span>{wh.name}{wh.location ? ` — ${wh.location}` : ''}</span>
                        </label>
                        );
                      })}
                    </div>
                  )}
                  <p className="form-hint">Workers only see inventory and stock for selected warehouses.</p>
                </div>
              )}
            </div>
            <div className="inv-modal-footer">
              <button type="button" className="btn-ghost" onClick={handleClose}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? <><i className="fas fa-spinner fa-spin" /> Sending…</> : <>Send invitation</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
