import { usePermissions } from '../../hooks/usePermissions';

/** Assigned store badge for store clerks — shown in the top navbar on every page. */
export default function ClerkStoreNavbarPill() {
  const { isStoreClerk, assignedStoreId, assignedStoreName } = usePermissions();
  if (!isStoreClerk || !assignedStoreId) return null;

  const label = assignedStoreName || 'Your store';

  return (
    <span className="pos-store-pill clerk-store-pill" title="Your assigned store">
      <span aria-hidden="true">🏪</span>
      <span>{label}</span>
    </span>
  );
}
