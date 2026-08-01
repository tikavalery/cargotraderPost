function Field({ label, value }) {
  return (
    <div className="settings-view-field">
      <div className="settings-view-label">{label}</div>
      <div className="settings-view-value">{value || '—'}</div>
    </div>
  );
}

export default function ViewStaffModal({ open, record, type, onClose, onResend }) {
  if (!open || !record) return null;

  const isInvite = type === 'invitation';

  return (
    <div className="inv-modal-overlay open settings-staff-modal" onClick={onClose} role="presentation">
      <div className="inv-modal inv-modal-lg" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="inv-modal-header">
          <div>
            <div className="inv-modal-title">{isInvite ? 'Invitation details' : 'Team member'}</div>
            <div className="inv-modal-sub">
              {isInvite ? record.email || record.phone : record.name}
            </div>
          </div>
          <button type="button" className="inv-modal-close" onClick={onClose} aria-label="Close">
            <i className="fas fa-times" />
          </button>
        </div>
        <div className="inv-modal-body">
          <div className="settings-view-grid">
            {!isInvite && <Field label="Name" value={record.name} />}
            <Field label="Email" value={record.email} />
            <Field label="Phone" value={record.phone} />
            <Field label="Role" value={record.role} />
            {record.role === 'Store Clerk' && (
              <Field
                label="Assigned store"
                value={record.assignedStoreName || record.assignedStoreId || '—'}
              />
            )}
            {record.role === 'Warehouse Worker' && (
              <Field
                label="Assigned warehouses"
                value={record.assignedWarehousesLabel || record.assignedWarehouseNames?.join(', ') || '—'}
              />
            )}
            {!isInvite && (
              <Field label="Status" value={record.isActive === false ? 'Inactive' : 'Active'} />
            )}
            {isInvite && <Field label="Status" value={record.status} />}
            {!isInvite && (
              <Field
                label="Last login"
                value={record.lastLoginAt ? new Date(record.lastLoginAt).toLocaleString() : '—'}
              />
            )}
            {!isInvite && (
              <Field
                label="Joined"
                value={record.createdAt ? new Date(record.createdAt).toLocaleDateString() : '—'}
              />
            )}
            {isInvite && (
              <Field
                label="Expires"
                value={record.expiresAt ? new Date(record.expiresAt).toLocaleString() : '—'}
              />
            )}
            {isInvite && record.invitedBy?.name && (
              <Field label="Invited by" value={record.invitedBy.name} />
            )}
          </div>
        </div>
        <div className="inv-modal-footer">
          {isInvite && record.status === 'pending' && onResend && (
            <button type="button" className="btn-secondary" onClick={() => onResend(record)}>
              <i className="fas fa-paper-plane" /> Resend invitation
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={onClose} style={{ marginLeft: 'auto' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
