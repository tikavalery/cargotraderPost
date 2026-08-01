import { Router } from 'express';
import { protect, attachUser, businessContext, requireBusiness } from '../middleware/auth.js';
import { authorizePermission } from '../middleware/rbac.js';
import * as ctrl from '../controllers/saleController.js';

const router = Router();
router.use(protect, attachUser, businessContext, requireBusiness);

router.get('/summary', authorizePermission('manageSales'), ctrl.summary);
router.get('/', authorizePermission('manageSales'), ctrl.list);
router.get('/:id', authorizePermission('manageSales'), ctrl.getOne);
router.post('/', authorizePermission('manageSales'), ctrl.create);
router.put('/:id', authorizePermission('manageSales'), ctrl.update);
router.delete('/:id', authorizePermission('manageSales'), ctrl.remove);

export default router;
