import { Router } from 'express';
import { protect, attachUser, businessContext, requireBusiness } from '../middleware/auth.js';
import { authorizePermission } from '../middleware/rbac.js';
import { requirePlanFeature, enforceShipmentYearlyLimit } from '../middleware/planLimits.js';
import * as ctrl from '../controllers/shipmentController.js';

const router = Router();
router.use(protect, attachUser, businessContext, requireBusiness);

const viewAuth = authorizePermission('viewShipments');
const manageAuth = authorizePermission('manageShipments');

router.get('/', viewAuth, ctrl.list);
router.get('/:id', viewAuth, ctrl.getOne);
router.post('/', manageAuth, requirePlanFeature('shipping'), enforceShipmentYearlyLimit, ctrl.create);
router.put('/:id', manageAuth, requirePlanFeature('shipping'), ctrl.update);
router.patch('/:id/status', manageAuth, requirePlanFeature('shipping'), ctrl.updateStatus);
router.post('/:id/complete', manageAuth, requirePlanFeature('shipping'), ctrl.complete);
router.delete('/:id', manageAuth, requirePlanFeature('shipping'), ctrl.remove);

export default router;
