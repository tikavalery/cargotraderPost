import { Router } from 'express';
import { protect, attachUser, businessContext, requireBusiness } from '../middleware/auth.js';
import * as ctrl from '../controllers/dashboardController.js';

const router = Router();
router.use(protect, attachUser, businessContext, requireBusiness);

router.get('/summary', ctrl.summary);
router.post('/refresh', ctrl.refresh);

export default router;
