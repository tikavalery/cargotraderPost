import { Router } from 'express';
import { protect, attachUser, businessContext, requireBusiness } from '../middleware/auth.js';
import { authorizePermission } from '../middleware/rbac.js';
import * as ctrl from '../controllers/stripeController.js';

const router = Router();

router.use(protect, attachUser, businessContext, requireBusiness);

/** Stripe Customer Portal — payment methods, cancellation, invoices */
router.post(
  '/customer-portal',
  authorizePermission('manageBusiness'),
  ctrl.createCustomerPortal
);

export default router;
