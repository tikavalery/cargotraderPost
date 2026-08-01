import { Router } from 'express';
import { protect, attachUser, businessContext, requireBusiness } from '../middleware/auth.js';
import { authorizePermission } from '../middleware/rbac.js';
import { enforceUserLimit } from '../middleware/planLimits.js';
import * as ctrl from '../controllers/invitationController.js';

const router = Router();

router.get('/roles', ctrl.listInvitableRoles);
router.get('/token/:token', ctrl.previewInvitation);
router.post('/accept', ctrl.acceptValidators, ctrl.acceptInvitation);

router.use(protect, attachUser, businessContext, requireBusiness);

router.get('/', authorizePermission('manageUsers'), ctrl.listInvitations);
router.post('/', authorizePermission('manageUsers'), enforceUserLimit, ctrl.inviteValidators, ctrl.createInvitation);
router.get('/:id', authorizePermission('manageUsers'), ctrl.getInvitation);
router.put('/:id', authorizePermission('manageUsers'), ctrl.updateInvitation);
router.delete('/:id', authorizePermission('manageUsers'), ctrl.revokeInvitation);
router.post('/:id/resend', authorizePermission('manageUsers'), ctrl.resendInvitation);

export default router;
