import { usePermissions } from '../hooks/usePermissions';

/** Shown when a store clerk has no store assigned yet. */
export default function ClerkStoreNotice() {
  const { isStoreClerk, assignedStoreId, role } = usePermissions();
  if (!isStoreClerk || assignedStoreId) return null;

  return (
    <div
      className="inv-fetch-error"
      style={{
        margin: '0 0 16px',
        padding: '12px 16px',
        borderRadius: 8,
        background: '#fffbeb',
        border: '1px solid #fde68a',
        color: '#92400e',
        fontSize: 14
      }}
      role="alert"
    >
      <strong>No store assigned.</strong> Your business owner must assign you to a store under{' '}
      <strong>Settings → Users &amp; Staff</strong> before you can view {role === 'Store Clerk' ? 'inventory or sales' : 'data'}.
    </div>
  );
}
