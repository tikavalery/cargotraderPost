import { Router } from 'express';
import { protect, attachUser, businessContext, requireBusiness } from '../middleware/auth.js';
import { authorizePermission, authorizeAnyPermission } from '../middleware/rbac.js';
import { requirePlanFeature, enforceStoreLimit } from '../middleware/planLimits.js';
import * as storeCtrl from '../controllers/storeController.js';
import * as posCtrl from '../controllers/posController.js';

const router = Router();
router.use(protect, attachUser, businessContext, requireBusiness);

const viewAuth = authorizeAnyPermission('manageSales', 'viewStores');
const manageSalesAuth = authorizePermission('manageSales');
const storeAdminAuth = authorizePermission('manageBusiness');

router.get('/', viewAuth, storeCtrl.listStores);
router.get('/transfer-destinations/warehouses', viewAuth, storeCtrl.listTransferWarehouses);
router.get('/transfer-destinations/stores', viewAuth, storeCtrl.listTransferStores);
router.get('/products/lookup', viewAuth, posCtrl.lookupProductHandler);
router.get('/:storeId/inventory', viewAuth, storeCtrl.getStoreInventory);
router.get('/:storeId/logs', viewAuth, storeCtrl.getStoreLogs);
router.get('/:storeId/products', viewAuth, posCtrl.getStoreProductsHandler);
router.get('/:storeId', viewAuth, storeCtrl.getStore);

router.post('/', storeAdminAuth, requirePlanFeature('pos'), enforceStoreLimit, storeCtrl.createStore);
router.put('/:storeId', storeAdminAuth, storeCtrl.updateStore);
router.delete('/:storeId', storeAdminAuth, storeCtrl.deleteStore);

export default router;
