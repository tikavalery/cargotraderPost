import { Router } from 'express';
import { protect, attachUser, businessContext, requireBusiness } from '../middleware/auth.js';
import { authorizePermission } from '../middleware/rbac.js';
import { enforceInventoryLimit } from '../middleware/planLimits.js';
import * as inv from '../controllers/inventoryController.js';
import * as sale from '../controllers/saleController.js';
import Item from '../models/Item.js';
import { asyncHandler } from '../utils/ApiError.js';

/** Backward-compatible paths for existing React client */
const router = Router();
router.use(protect, attachUser, businessContext, requireBusiness);

router.get('/inventory/summary', authorizePermission('viewInventory'), inv.inventorySummary);
router.get('/inventory/items', authorizePermission('viewInventory'), inv.listLoose);
router.post('/inventory/items', authorizePermission('manageInventory'), enforceInventoryLimit, inv.createLoose);
router.put('/inventory/items/:id', authorizePermission('manageInventory'), inv.updateLoose);
router.delete('/inventory/items/:id', authorizePermission('manageInventory'), inv.removeLoose);
router.get('/pos/sales', authorizePermission('manageSales'), sale.list);
router.post('/pos/sales', authorizePermission('manageSales'), sale.create);

router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const items = await Item.find({ business: req.businessId, status: { $ne: 'Returned' }, qty: { $gt: 0 } });
    res.json({
      ok: true,
      inventoryQty: items.reduce((s, i) => s + i.qty, 0),
      inventoryValue: items.reduce((s, i) => s + (i.value || 0), 0),
      itemCount: items.length
    });
  })
);

export default router;
