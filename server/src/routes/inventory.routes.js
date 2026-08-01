import { Router } from 'express';
import { protect, attachUser, businessContext, requireBusiness } from '../middleware/auth.js';
import { authorizePermission } from '../middleware/rbac.js';
import { enforceInventoryLimit } from '../middleware/planLimits.js';
import { redactCostResponse } from '../middleware/redactCost.js';
import { checkWarehouseAccess } from '../middleware/checkWarehouseAccess.js';
import * as ctrl from '../controllers/inventoryController.js';

const router = Router();
router.use(protect, attachUser, businessContext, requireBusiness);
router.use(checkWarehouseAccess);
router.use(redactCostResponse);

router.get('/stats', authorizePermission('viewInventory'), ctrl.inventoryStats);
router.get('/activity-log', authorizePermission('viewInventory'), ctrl.listActivityLog);

router.get('/groups', authorizePermission('viewInventory'), ctrl.listItemGroups);
router.post('/groups', authorizePermission('manageInventory'), ctrl.createItemGroup);
router.delete('/groups/:name', authorizePermission('manageInventory'), ctrl.removeItemGroup);
router.get('/items', authorizePermission('viewInventory'), ctrl.listLoose);
router.get('/items/scan/:code', authorizePermission('viewInventory'), ctrl.scanItem);
router.get('/items/:id', authorizePermission('viewInventory'), ctrl.getLooseOne);
router.post('/items', authorizePermission('manageInventory'), enforceInventoryLimit, ctrl.createLoose);
router.put('/items/:id', authorizePermission('manageInventory'), ctrl.updateLoose);
router.patch('/items/bulk', authorizePermission('manageInventory'), ctrl.bulkUpdateLoose);
router.delete('/items', authorizePermission('manageInventory'), ctrl.bulkDeleteLoose);
router.delete('/items/:id', authorizePermission('manageInventory'), ctrl.removeLoose);

router.get('/summary', authorizePermission('viewInventory'), ctrl.inventorySummary);

export default router;
