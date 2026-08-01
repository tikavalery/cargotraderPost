import { Router } from 'express';
import { protect, attachUser } from '../middleware/auth.js';
import { authorizePermission } from '../middleware/rbac.js';
import * as ctrl from '../controllers/businessController.js';

const router = Router();
router.use(protect, attachUser);

router.get('/', ctrl.listBusinesses);
router.post('/', ctrl.createBusiness);
router.get('/:id', ctrl.getBusiness);
router.put('/:id', authorizePermission('manageBusiness'), ctrl.updateBusiness);
router.post('/:id/members', authorizePermission('manageBusiness'), ctrl.addMember);
router.delete('/:id', ctrl.deleteBusiness);

export default router;
