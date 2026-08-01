import { Router } from 'express';
import { protect, attachUser, businessContext, requireBusiness } from '../middleware/auth.js';
import * as ctrl from '../controllers/inventoryController.js';

const router = Router();
router.use(protect, attachUser, businessContext, requireBusiness);
router.get('/', ctrl.listLocations);

export default router;
