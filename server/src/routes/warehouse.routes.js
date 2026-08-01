import { Router } from 'express';
import { protect, attachUser, businessContext, requireBusiness } from '../middleware/auth.js';
import { authorizePermission, authorizeAnyPermission } from '../middleware/rbac.js';
import { requirePlanFeature, enforceWarehouseLimit, enforceInventoryLimit } from '../middleware/planLimits.js';
import * as ctrl from '../controllers/warehouseController.js';

const router = Router();
router.use(protect, attachUser, businessContext, requireBusiness);

const viewAuth = authorizeAnyPermission('manageInventory', 'viewWarehouses');
const manageAuth = authorizePermission('manageInventory');

router.get('/kpis', viewAuth, ctrl.getKpis);
router.get('/', viewAuth, ctrl.listWarehouses);
router.get('/:warehouseId', viewAuth, ctrl.getWarehouse);
router.get('/:warehouseId/stock', viewAuth, ctrl.getStock);
router.get('/:warehouseId/logs', viewAuth, ctrl.getLogs);

router.post('/transfer', authorizeAnyPermission('manageInventory', 'manageSales'), ctrl.transferStock);
router.post('/', authorizePermission('manageWarehouses'), enforceWarehouseLimit, ctrl.createWarehouse);
router.put('/:warehouseId', authorizePermission('manageWarehouses'), ctrl.updateWarehouse);
router.delete('/:warehouseId', authorizePermission('manageWarehouses'), ctrl.deleteWarehouse);
router.post('/:warehouseId/stock', manageAuth, enforceInventoryLimit, ctrl.addStock);
router.put('/:warehouseId/stock/:itemId', manageAuth, ctrl.updateStock);
router.delete('/:warehouseId/stock/:itemId', manageAuth, ctrl.deleteStock);

export default router;
