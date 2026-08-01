import { Router } from 'express';
import { protect, attachUser, businessContext, requireBusiness } from '../middleware/auth.js';
import { authorizePermission } from '../middleware/rbac.js';
import * as ctrl from '../controllers/subscriptionController.js';

const router = Router();

router.get('/plans', ctrl.listPlans);

router.use(protect, attachUser, businessContext, requireBusiness);

router.get('/current', ctrl.getCurrent);
router.get('/usage', ctrl.getUsage);
router.post(
  '/create-checkout-session',
  authorizePermission('manageBusiness'),
  ctrl.createCheckoutSessionHandler
);
router.post(
  '/confirm-checkout',
  authorizePermission('manageBusiness'),
  ctrl.confirmCheckoutSession
);
router.post('/sync', authorizePermission('manageBusiness'), ctrl.syncSubscription);
router.post('/downgrade', authorizePermission('manageBusiness'), ctrl.downgradePlan);
router.post('/change-plan', authorizePermission('manageBusiness'), ctrl.changePlanHandler);
router.post('/select-free', authorizePermission('manageBusiness'), ctrl.selectFreePlan);

export default router;
