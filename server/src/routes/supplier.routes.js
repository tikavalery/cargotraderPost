import { Router } from 'express';
import { protect, attachUser, businessContext, requireBusiness } from '../middleware/auth.js';
import { authorizePermission } from '../middleware/rbac.js';
import * as ctrl from '../controllers/purchaseController.js';

const router = Router();
router.use(protect, attachUser, businessContext, requireBusiness);

const viewAuth = authorizePermission('viewPurchases');
const manageAuth = authorizePermission('managePurchases');

router.get('/', viewAuth, ctrl.listSuppliers);
router.delete('/bulk', manageAuth, ctrl.bulkDeleteSuppliers);
router.get('/:id', viewAuth, ctrl.getSupplier);
router.post('/', manageAuth, ctrl.createSupplier);
router.put('/:id', manageAuth, ctrl.updateSupplier);
router.delete('/:id', manageAuth, ctrl.deleteSupplier);

export default router;
