import Store from '../models/Store.js';
import ApiError from '../utils/ApiError.js';
import { ROLES } from '../constants/roles.js';
import { itemBelongsToStore, locationLabelForStore } from './posHelpers.js';

export function isStoreClerkRole(role) {
  return role === ROLES.STORE_CLERK;
}

export function getAssignedStoreId(userDoc, businessId, businessRole) {
  if (businessRole !== ROLES.STORE_CLERK) return null;
  const membership = userDoc?.businesses?.find((b) => String(b.business) === String(businessId));
  const id = membership?.assignedStoreId || '';
  return id.trim() || null;
}

export async function loadAssignedStore(businessId, storeId) {
  if (!storeId) return null;
  return Store.findOne({ business: businessId, storeId, active: { $ne: false } }).lean();
}

export function storeDisplayName(store) {
  if (!store) return '';
  const city = store.city ? String(store.city).trim() : '';
  const name = store.name ? String(store.name).trim() : '';
  if (name && city) return `${name} — ${city}`;
  return name || city || store.storeId || '';
}

export async function validateClerkStoreAssignment(businessId, role, assignedStoreId) {
  if (role !== ROLES.STORE_CLERK) return '';
  const id = String(assignedStoreId || '').trim();
  if (!id) throw new ApiError(400, 'Assigned store is required for Store Clerk');
  const store = await loadAssignedStore(businessId, id);
  if (!store) throw new ApiError(400, 'Selected store was not found or is inactive');
  return id;
}

/** Throws if a store clerk accesses another store's data. */
export function assertClerkStoreAccess(req, storeId) {
  const assigned = getAssignedStoreId(req.userDoc, req.businessId, req.businessRole);
  if (!assigned) {
    if (req.businessRole === ROLES.STORE_CLERK) {
      throw new ApiError(403, 'No store assigned — ask your business owner to assign a store');
    }
    return;
  }
  if (storeId && String(storeId) !== String(assigned)) {
    throw new ApiError(403, 'Forbidden — you can only access your assigned store');
  }
}

/** Force POS/sales queries to the clerk's assigned store. */
export function clerkStoreFilter(req, requestedStoreId) {
  const assigned = getAssignedStoreId(req.userDoc, req.businessId, req.businessRole);
  if (req.businessRole !== ROLES.STORE_CLERK) return requestedStoreId || null;
  if (!assigned) {
    throw new ApiError(403, 'No store assigned — ask your business owner to assign a store');
  }
  if (requestedStoreId && String(requestedStoreId) !== String(assigned)) {
    throw new ApiError(403, 'Forbidden — you can only access your assigned store');
  }
  return assigned;
}

export async function filterItemsForClerk(items, businessId, storeId, businessRole) {
  if (businessRole === ROLES.STORE_CLERK) {
    if (!storeId) return [];
    const store = await loadAssignedStore(businessId, storeId);
    return items.filter((item) => itemBelongsToStore(item, storeId, store));
  }
  if (!storeId) return items;
  const store = await loadAssignedStore(businessId, storeId);
  return items.filter((item) => itemBelongsToStore(item, storeId, store));
}

export async function clerkLocationNames(businessId, storeId) {
  const store = await loadAssignedStore(businessId, storeId);
  if (!store) return [];
  const label = locationLabelForStore(store);
  const names = new Set([label, store.name, store.city, store.locationToken].filter(Boolean));
  return [...names];
}
