import { isValidId } from './ids.js';
import { Warehouse } from '../models/Warehouse.js';
import ApiError from '../utils/ApiError.js';
import { ROLES } from '../constants/roles.js';
import { warehouseMatchFilter, docMatchesWarehouse } from './warehouseHelpers.js';

export function isWarehouseWorkerRole(role) {
  return role === ROLES.WAREHOUSE_WORKER;
}

/** Business Owner, Manager, and Admin see every warehouse in the business. */
export function canAccessAllWarehouses(role) {
  return role === ROLES.BUSINESS_OWNER || role === ROLES.MANAGER || role === ROLES.ADMIN;
}

/** Warehouse IDs assigned to this worker for the active business (null = unrestricted role). */
export function getAssignedWarehouseIds(userDoc, businessId, businessRole) {
  if (!isWarehouseWorkerRole(businessRole)) return null;
  const membership = userDoc?.businesses?.find((b) => String(b.business) === String(businessId));
  const ids = membership?.assignedWarehouses || [];
  return ids.map((id) => String(id)).filter(Boolean);
}

/**
 * Assigned warehouses, optionally narrowed by req.query.warehouseId when the worker
 * has multiple assignments (navbar switcher). Returns null for unrestricted roles.
 */
export async function getEffectiveWarehouseIds(req) {
  const assigned = getAssignedWarehouseIds(req.userDoc, req.businessId, req.businessRole);
  if (assigned === null) return null;
  if (!assigned.length) return [];

  const raw = req.query?.warehouseId;
  if (!raw) return assigned;

  const requested = await resolveWarehouseObjectIds(req.businessId, [raw], { throwOnMissing: false });
  if (!requested.length) {
    throw new ApiError(403, 'Forbidden — warehouse is outside your assignment');
  }

  const assignedResolved = await resolveWarehouseObjectIds(req.businessId, assigned, {
    throwOnMissing: false
  });
  const allowed = requested.filter((id) => assignedResolved.includes(id));
  if (!allowed.length) {
    throw new ApiError(403, 'Forbidden — you can only access your assigned warehouses');
  }
  return allowed;
}

export async function loadAssignedWarehouses(businessId, warehouseIds) {
  if (!warehouseIds?.length) return [];
  const objectIds = await resolveWarehouseObjectIds(businessId, warehouseIds, { throwOnMissing: false });
  if (!objectIds.length) return [];
  return Warehouse.find({ business: businessId, _id: { $in: objectIds } }).lean();
}

/** Accept MongoDB _id or warehouse slug (e.g. wh-a); always returns ObjectId strings. */
export async function resolveWarehouseObjectIds(businessId, rawIds, { throwOnMissing = true } = {}) {
  const ids = (Array.isArray(rawIds) ? rawIds : []).map((id) => String(id).trim()).filter(Boolean);
  if (!ids.length) return [];

  const warehouses = await Warehouse.find({ business: businessId }).select('_id warehouseId').lean();
  const byObjectId = new Map(warehouses.map((w) => [String(w._id), w]));
  const bySlug = new Map(warehouses.map((w) => [w.warehouseId, w]));

  const resolved = [];
  const missing = [];
  for (const id of ids) {
    let wh = byObjectId.get(id);
    if (!wh && isValidId(id)) {
      wh = byObjectId.get(String(String(id)));
    }
    if (!wh) wh = bySlug.get(id);
    if (wh) resolved.push(String(wh._id));
    else missing.push(id);
  }

  if (missing.length && throwOnMissing) {
    throw new ApiError(400, 'One or more selected warehouses were not found');
  }

  return [...new Set(resolved)];
}

export function warehouseDisplayName(wh) {
  if (!wh) return '';
  return wh.name || wh.location || wh.warehouseId || '';
}

/** Require at least one valid warehouse when inviting or editing a Warehouse Worker. */
export async function validateWarehouseWorkerAssignment(businessId, role, assignedWarehouses) {
  if (role !== ROLES.WAREHOUSE_WORKER) return [];
  const ids = (Array.isArray(assignedWarehouses) ? assignedWarehouses : [])
    .map((id) => String(id).trim())
    .filter(Boolean);
  if (!ids.length) {
    throw new ApiError(400, 'At least one warehouse is required for Warehouse Worker');
  }
  return resolveWarehouseObjectIds(businessId, ids);
}

/** Throws if a warehouse worker accesses a warehouse outside their assignment. */
export function assertWarehouseAccess(req, warehouse) {
  const assigned = getAssignedWarehouseIds(req.userDoc, req.businessId, req.businessRole);
  if (assigned === null) return;
  if (!assigned.length) {
    throw new ApiError(403, 'No warehouses assigned — ask your business owner to assign warehouses');
  }
  const whId = String(warehouse._id);
  const whSlug = warehouse.warehouseId ? String(warehouse.warehouseId) : '';
  const ok = assigned.some((id) => id === whId || (whSlug && id === whSlug));
  if (!ok) {
    throw new ApiError(403, 'Forbidden — you can only access your assigned warehouses');
  }
}

/** Loose stock sitting in a warehouse (not allocated to a retail store). */
export function isWarehouseLooseItem(item) {
  if (item?.storeId) return false;
  if (item?.status === 'In Store') return false;
  return true;
}

/** Mongo clause: item is warehouse loose stock, not store shelf stock. */
export function warehouseLooseStockClause() {
  return {
    $and: [
      { $or: [{ storeId: { $exists: false } }, { storeId: null }, { storeId: '' }] },
      { status: { $nin: ['In Store'] } }
    ]
  };
}

/** Throws if a warehouse worker accesses inventory outside their assignment. */
export async function assertWorkerItemAccess(req, item) {
  const whIds = getAssignedWarehouseIds(req.userDoc, req.businessId, req.businessRole);
  if (whIds === null) return;
  if (!whIds.length) {
    throw new ApiError(403, 'No warehouses assigned — ask your business owner to assign warehouses');
  }
  const scoped = await filterItemsForWarehouseWorker([item], req.businessId, whIds, req.businessRole);
  if (!scoped.length) {
    throw new ApiError(403, 'Forbidden — item is outside your assigned warehouses');
  }
}
/** Mongo filter that limits inventory queries to assigned warehouses. */
export async function buildWarehouseItemScopeFilter(businessId, warehouseIds) {
  const objectIds = await resolveWarehouseObjectIds(businessId, warehouseIds, { throwOnMissing: false });
  if (!objectIds.length) return { _id: { $exists: false } };
  const warehouses = await Warehouse.find({ business: businessId, _id: { $in: objectIds } });
  if (!warehouses.length) return { _id: { $exists: false } };
  const orClauses = warehouses.flatMap((wh) => warehouseMatchFilter(wh).$or);
  return {
    $and: [{ $or: orClauses }, warehouseLooseStockClause()]
  };
}

export async function filterItemsForWarehouseWorker(items, businessId, warehouseIds, businessRole) {
  if (!isWarehouseWorkerRole(businessRole)) return items;
  if (!warehouseIds?.length) return [];
  const warehouses = await loadAssignedWarehouses(businessId, warehouseIds);
  return items.filter(
    (item) => isWarehouseLooseItem(item) && warehouses.some((wh) => docMatchesWarehouse(item, wh))
  );
}

export async function warehouseScopeLabels(businessId, warehouseIds) {
  const warehouses = await loadAssignedWarehouses(businessId, warehouseIds);
  return warehouses.map(warehouseDisplayName).filter(Boolean);
}

export function warehouseWorkerScopeMessage(names) {
  if (!names?.length) return '';
  if (names.length === 1) return `You only have access to ${names[0]} items`;
  return `You only have access to items in: ${names.join(', ')}`;
}
