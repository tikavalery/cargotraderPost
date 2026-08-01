import {
  getAssignedWarehouseIds,
  isWarehouseWorkerRole,
  warehouseScopeLabels
} from '../utils/warehouseScope.js';

/**
 * Attaches warehouse scope to the request for Warehouse Workers.
 * Business Owner and Admin get unrestricted scope (warehouseIds = null).
 */
export async function checkWarehouseAccess(req, res, next) {
  const restricted = isWarehouseWorkerRole(req.businessRole);
  const warehouseIds = getAssignedWarehouseIds(req.userDoc, req.businessId, req.businessRole);

  req.warehouseScope = {
    restricted,
    warehouseIds: warehouseIds || [],
    labels: []
  };

  if (restricted && warehouseIds?.length) {
    req.warehouseScope.labels = await warehouseScopeLabels(req.businessId, warehouseIds);
  }

  next();
}
