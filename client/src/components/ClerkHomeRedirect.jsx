import { Navigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';

/** Role-specific landing: clerks → POS, warehouse workers → inventory. */
export default function ClerkHomeRedirect({ children }) {
  const { isStoreClerk, isWarehouseWorker } = usePermissions();
  if (isStoreClerk) return <Navigate to="/stores/pos" replace />;
  if (isWarehouseWorker) return <Navigate to="/inventory/items" replace />;
  return children;
}
