export default function DeleteStaffConfirmModal({ open, record, type, onClose, onConfirm, loading }) {
  if (!open || !record) return null;

  const isInvite = type === 'invitation';
  const label = isInvite ? (record.email || record.phone) : record.name;

  return (
    <div className="inv-modal-overlay open elevated settings-staff-modal" onClick={onClose} role="presentation">
      <div className="inv-modal" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-labelledby="delete-staff-title">
        <div className="inv-modal-header">
          <div>
            <div className="inv-modal-title" id="delete-staff-title">
              {isInvite ? 'Revoke invitation?' : 'Remove team member?'}
            </div>
            <div className="inv-modal-sub">
              {isInvite
                ? `This will cancel the pending invite for ${label}.`
                : `${label} will lose access to this business.`}
            </div>
          </div>
          <button type="button" className="inv-modal-close" onClick={onClose} aria-label="Close">
            <i className="fas fa-times" />
          </button>
        </div>
        <div className="inv-modal-footer">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button type="button" className="btn-primary" style={{ background: 'var(--danger)' }} onClick={onConfirm} disabled={loading}>
            {loading ? <><i className="fas fa-spinner fa-spin" /> Removing…</> : isInvite ? 'Revoke' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}
