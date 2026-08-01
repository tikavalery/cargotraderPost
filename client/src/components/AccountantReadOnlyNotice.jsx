import { usePermissions } from '../hooks/usePermissions';

/** Banner for roles with read-only access to operations modules. */
export default function AccountantReadOnlyNotice({ module = 'this section' }) {
  const { isOperationsReadOnly } = usePermissions();
  if (!isOperationsReadOnly) return null;

  return (
    <div
      className="warehouse-scope-notice"
      style={{
        margin: '0 0 16px',
        padding: '12px 16px',
        borderRadius: 8,
        background: 'rgba(59, 130, 246, 0.08)',
        border: '1px solid rgba(59, 130, 246, 0.35)',
        color: '#1e40af',
        fontSize: 14
      }}
      role="status"
    >
      <i className="fas fa-eye" style={{ marginRight: 8 }} aria-hidden="true" />
      <strong>Read-only access.</strong> As an Accountant you can view {module} but cannot make changes.
    </div>
  );
}
