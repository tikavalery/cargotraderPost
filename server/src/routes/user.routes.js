import { Router } from 'express';
import { protect, attachUser, businessContext, requireBusiness } from '../middleware/auth.js';
import { authorizePermission } from '../middleware/rbac.js';
import * as ctrl from '../controllers/userController.js';

const router = Router();
router.use(protect, attachUser, businessContext);

router.get('/me/profile', ctrl.getProfile);
router.put('/me/profile', ctrl.updateProfile);

router.use(requireBusiness);
router.get('/', authorizePermission('manageUsers'), ctrl.listUsers);
router.get('/:id', authorizePermission('manageUsers'), ctrl.getUser);
router.put('/:id', authorizePermission('manageUsers'), ctrl.updateUser);
router.delete('/:id', authorizePermission('manageUsers'), ctrl.deleteUser);

export default router;
