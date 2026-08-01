import { Router } from 'express';
import { protect, attachUser, businessContext, requireBusiness } from '../middleware/auth.js';
import { authorizePermission } from '../middleware/rbac.js';
import { enforceInventoryLimit } from '../middleware/planLimits.js';
import * as ctrl from '../controllers/inventoryController.js';

const router = Router();
router.use(protect, attachUser, businessContext, requireBusiness);

router.get('/summary', ctrl.inventorySummary);
router.get('/', authorizePermission('viewInventory'), ctrl.itemCtrl.list);
router.get('/:id', authorizePermission('viewInventory'), ctrl.itemCtrl.getOne);
router.post('/', authorizePermission('manageInventory'), enforceInventoryLimit, ctrl.itemCtrl.create);
router.put('/:id', authorizePermission('manageInventory'), ctrl.itemCtrl.update);
router.delete('/:id', authorizePermission('manageInventory'), ctrl.itemCtrl.remove);

export default router;
