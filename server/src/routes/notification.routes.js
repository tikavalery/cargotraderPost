import { Router } from 'express';
import { protect, attachUser, businessContext } from '../middleware/auth.js';
import * as ctrl from '../controllers/notificationController.js';

const router = Router();
router.use(protect, attachUser, businessContext);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.patch('/read-all', ctrl.markAllRead);
router.patch('/:id/read', ctrl.markRead);
router.delete('/:id', ctrl.remove);

export default router;
