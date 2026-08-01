import { useAuth } from '../context/AuthContext';
import {
  can,
  canAny,
  canManageInventory,
  canViewCost,
  canViewStores,
  isStoreClerk,
  isWarehouseWorker,
  isManager,
  isAccountant,
  isOperationsReadOnly,
  warehouseScopeMessage
} from '../utils/permissions';

/** Role-based UI capabilities derived from the signed-in user. */
export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role;
  const assignedWarehouseNames = user?.assignedWarehouseNames || [];
  const assignedWarehouseIds = user?.assignedWarehouseIds || [];

  return {
    role,
    isStoreClerk: isStoreClerk(role),
    isWarehouseWorker: isWarehouseWorker(role),
    isManager: isManager(role),
    isAccountant: isAccountant(role),
    isOperationsReadOnly: isOperationsReadOnly(role),
    assignedStoreId: user?.assignedStoreId || '',
    assignedStoreName: user?.assignedStoreName || '',
    assignedWarehouseIds,
    assignedWarehouseNames,
    assignedWarehousesLabel: user?.assignedWarehousesLabel || assignedWarehouseNames.join(', '),
    warehouseScopeMessage: warehouseScopeMessage(assignedWarehouseNames),
    canViewCost: canViewCost(role),
    canManageInventory: canManageInventory(role),
    canViewStores: canViewStores(role),
    canManageStores: can(role, 'manageBusiness'),
    canManageSales: can(role, 'manageSales'),
    canViewPurchases: can(role, 'viewPurchases'),
    canManagePurchases: can(role, 'managePurchases'),
    canViewWarehouses: can(role, 'viewWarehouses'),
    canViewShipments: can(role, 'viewShipments'),
    canManageShipments: can(role, 'manageShipments'),
    canViewFinance: can(role, 'viewFinance'),
    canManageFinance: can(role, 'manageFinance'),
    canManageUsers: can(role, 'manageUsers'),
    canViewSettings: can(role, 'viewSettings'),
    canManageWarehouses: can(role, 'manageWarehouses'),
    canAccessPurchasing: canAny(role, ['viewPurchases', 'managePurchases']),
    canAccessWarehouses: canAny(role, ['viewWarehouses', 'manageInventory']),
    canAccessShipping: canAny(role, ['viewShipments', 'manageShipments']),
    inventoryReadOnly: isStoreClerk(role) || isOperationsReadOnly(role) || !canManageInventory(role)
  };
}
