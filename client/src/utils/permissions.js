/** Mirrors server PERMISSIONS in server/src/constants/roles.js */
export const PERMISSIONS = {
  manageBusiness: ['Business Owner', 'Manager', 'Admin'],
  viewInventory: [
    'Business Owner',
    'Manager',
    'Accountant',
    'Warehouse Worker',
    'Store Clerk',
    'Individual Seller',
    'Admin',
    'Viewer'
  ],
  manageInventory: ['Business Owner', 'Manager', 'Warehouse Worker', 'Admin'],
  viewCost: ['Business Owner', 'Manager', 'Warehouse Worker', 'Accountant', 'Admin', 'Viewer'],
  viewPurchases: ['Business Owner', 'Manager', 'Accountant', 'Admin', 'Viewer'],
  managePurchases: ['Business Owner', 'Manager', 'Admin'],
  viewWarehouses: ['Business Owner', 'Manager', 'Accountant', 'Warehouse Worker', 'Admin', 'Viewer'],
  manageWarehouses: ['Business Owner', 'Manager', 'Admin'],
  viewShipments: ['Business Owner', 'Manager', 'Accountant', 'Admin', 'Viewer'],
  manageShipments: ['Business Owner', 'Manager', 'Admin'],
  viewStores: ['Business Owner', 'Manager', 'Accountant', 'Store Clerk', 'Individual Seller', 'Admin'],
  manageSales: ['Business Owner', 'Manager', 'Store Clerk', 'Individual Seller', 'Admin'],
  viewFinance: ['Business Owner', 'Manager', 'Accountant', 'Admin'],
  manageFinance: ['Business Owner', 'Manager', 'Accountant', 'Admin'],
  manageUsers: ['Business Owner', 'Manager', 'Admin'],
  viewSettings: ['Business Owner', 'Manager', 'Accountant', 'Admin']
};

export const STORE_CLERK_ROLE = 'Store Clerk';
export const WAREHOUSE_WORKER_ROLE = 'Warehouse Worker';
export const MANAGER_ROLE = 'Manager';
export const ACCOUNTANT_ROLE = 'Accountant';

export function can(role, permission) {
  return (PERMISSIONS[permission] || []).includes(role);
}

export function canAny(role, permissions) {
  return permissions.some((p) => can(role, p));
}

export function isStoreClerk(role) {
  return role === STORE_CLERK_ROLE;
}

export function isWarehouseWorker(role) {
  return role === WAREHOUSE_WORKER_ROLE;
}

export function isManager(role) {
  return role === MANAGER_ROLE;
}

export function isAccountant(role) {
  return role === ACCOUNTANT_ROLE;
}

export function canViewCost(role) {
  return can(role, 'viewCost');
}

export function canManageInventory(role) {
  return can(role, 'manageInventory');
}

export function canViewStores(role) {
  return can(role, 'viewStores');
}

/** Read-only access to ops modules (inventory, purchases, warehouses, shipping, stores). */
export function isOperationsReadOnly(role) {
  return isAccountant(role);
}

export function canModifyStaff(row, currentUser) {
  if (row?.role === 'Business Owner') return false;
  if (
    currentUser?.role === MANAGER_ROLE &&
    row?.id &&
    currentUser?.id &&
    String(row.id) === String(currentUser.id)
  ) {
    return false;
  }
  return true;
}

export function warehouseScopeMessage(names) {
  if (!names?.length) return '';
  if (names.length === 1) return `You only have access to ${names[0]} items`;
  return `You only have access to items in: ${names.join(', ')}`;
}
