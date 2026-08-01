import { Router } from 'express';
import { protect, attachUser, businessContext, requireBusiness } from '../middleware/auth.js';
import { authorizePermission } from '../middleware/rbac.js';
import { requirePlanFeature, enforceShipmentYearlyLimit } from '../middleware/planLimits.js';
import * as ctrl from '../controllers/shippingController.js';

const router = Router();
router.use(protect, attachUser, businessContext, requireBusiness);

const viewAuth = authorizePermission('viewShipments');
const manageAuth = authorizePermission('manageShipments');

router.get('/stats', viewAuth, ctrl.getStats);
router.get('/shipments/next-id', viewAuth, ctrl.nextId);
router.get('/shipments', viewAuth, ctrl.listShipments);
router.get('/shipments/:shipmentId', viewAuth, ctrl.getShipment);
router.get('/shipments/:shipmentId/items', viewAuth, ctrl.listShipmentItems);
router.get('/shipments/:shipmentId/tracking', viewAuth, ctrl.getTracking);
router.post('/shipments/:shipmentId/tracking/refresh', manageAuth, requirePlanFeature('shipping'), ctrl.refreshTracking);
router.get('/documents', viewAuth, ctrl.listDocuments);
router.get('/documents/:docId/file', viewAuth, ctrl.downloadDocument);
router.get('/documents/:docId', viewAuth, ctrl.getDocument);

router.post('/shipments', manageAuth, requirePlanFeature('shipping'), enforceShipmentYearlyLimit, ctrl.createShipment);
router.put('/shipments/:shipmentId', manageAuth, requirePlanFeature('shipping'), ctrl.updateShipment);
router.patch('/shipments/:shipmentId/status', manageAuth, requirePlanFeature('shipping'), ctrl.updateStatus);
router.post('/shipments/:shipmentId/complete', manageAuth, requirePlanFeature('shipping'), ctrl.completeShipment);
router.patch('/shipments/:shipmentId/costs', manageAuth, requirePlanFeature('shipping'), ctrl.patchCosts);
router.delete('/shipments/:shipmentId', manageAuth, requirePlanFeature('shipping'), ctrl.deleteShipment);
router.post('/documents', manageAuth, requirePlanFeature('shipping'), ctrl.createDocument);
router.put('/documents/:docId', manageAuth, requirePlanFeature('shipping'), ctrl.updateDocument);
router.delete('/documents/:docId', manageAuth, ctrl.deleteDocument);

export default router;
