import { Router } from 'express';
import { protect, attachUser, businessContext, requireBusiness } from '../middleware/auth.js';
import { authorizeAnyPermission } from '../middleware/rbac.js';
import { uploadRateLimiter } from '../middleware/rateLimits.js';
import * as ctrl from '../controllers/uploadController.js';

const router = Router();
router.use(protect, attachUser, businessContext, requireBusiness, uploadRateLimiter);

const canUpload = authorizeAnyPermission(
  'managePurchases',
  'manageInventory',
  'manageShipments',
  'manageSales'
);

router.post('/photos', canUpload, ctrl.uploadPhotos);
router.post('/document', canUpload, ctrl.uploadDocument);
router.post('/migrate-photos', canUpload, ctrl.migratePhotos);
router.post('/migrate-legacy', canUpload, ctrl.migrateLegacyMedia);

export default router;
