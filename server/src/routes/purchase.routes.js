import { Router } from 'express';
import { protect, attachUser, businessContext, requireBusiness } from '../middleware/auth.js';
import { authorizePermission, authorizeAnyPermission } from '../middleware/rbac.js';
import { requirePlanFeature, enforceAiAnalysisLimit } from '../middleware/planLimits.js';
import * as ctrl from '../controllers/purchaseController.js';

const router = Router();
router.use(protect, attachUser, businessContext, requireBusiness);

const viewAuth = authorizePermission('viewPurchases');
const manageAuth = authorizePermission('managePurchases');

router.get('/', viewAuth, ctrl.listPurchases);
router.post(
  '/analyze-image',
  manageAuth,
  requirePlanFeature('purchaseAiFill'),
  enforceAiAnalysisLimit,
  ctrl.analyzePurchaseImage
);
router.post(
  '/analyze-receipt',
  manageAuth,
  requirePlanFeature('purchaseAiFill'),
  enforceAiAnalysisLimit,
  ctrl.analyzePurchaseReceipt
);
router.post(
  '/match-item-photos',
  manageAuth,
  requirePlanFeature('purchaseAiFill'),
  enforceAiAnalysisLimit,
  ctrl.matchBulkItemPhotos
);
router.post('/bulk-create', manageAuth, requirePlanFeature('purchases'), ctrl.createBulkPurchases);
router.get('/:purchaseId', viewAuth, ctrl.getPurchase);
router.post('/', manageAuth, requirePlanFeature('purchases'), ctrl.createPurchase);
router.put('/:purchaseId', manageAuth, ctrl.updatePurchase);
router.patch('/bulk', manageAuth, ctrl.bulkUpdatePurchases);
router.delete('/bulk', manageAuth, ctrl.bulkDeletePurchases);
router.delete('/:purchaseId', manageAuth, ctrl.deletePurchase);

export default router;
