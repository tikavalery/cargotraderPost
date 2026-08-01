import { Router } from 'express';
import { protect, attachUser, businessContext, requireBusiness } from '../middleware/auth.js';
import { authorizePermission, authorizeAnyPermission } from '../middleware/rbac.js';
import { requirePlanFeature } from '../middleware/planLimits.js';
import * as ctrl from '../controllers/posController.js';
import * as momoCtrl from '../controllers/posMobileMoneyController.js';

const router = Router();
router.use(protect, attachUser, businessContext, requireBusiness);

const viewAuth = authorizeAnyPermission('manageSales', 'viewStores');
const manageAuth = authorizePermission('manageSales');

router.get('/customers', viewAuth, ctrl.listCustomers);
router.get('/transactions', viewAuth, ctrl.listTransactions);
router.get('/transactions/:transactionId/returnable', viewAuth, ctrl.getReturnableTransaction);
router.get('/transactions/:transactionId', viewAuth, ctrl.getTransaction);
router.get('/sales-returns', viewAuth, ctrl.listSalesReturns);
router.get('/sales-returns/:returnId', viewAuth, ctrl.getSalesReturn);
router.delete('/sales-returns/:returnId', manageAuth, ctrl.deleteSalesReturn);
router.get('/held', viewAuth, ctrl.listHeld);
router.get('/held/:heldId/resume', viewAuth, ctrl.resumeHeld);
router.get('/register', viewAuth, ctrl.getRegister);
router.get('/stats/today', viewAuth, ctrl.todayStats);

router.get('/mobile-money/status/:txRef', manageAuth, momoCtrl.getMobileMoneyPaymentStatus);
router.post('/promo/validate', manageAuth, ctrl.validatePromo);
router.post('/transactions', manageAuth, requirePlanFeature('pos'), ctrl.createTransaction);
router.post('/mobile-money/initiate', manageAuth, requirePlanFeature('pos'), momoCtrl.initiateMobileMoneyPayment);
router.post('/held', manageAuth, ctrl.createHeld);
router.delete('/held/:heldId', manageAuth, ctrl.deleteHeld);
router.post('/returns', manageAuth, ctrl.processReturn);
router.patch('/register/close', manageAuth, ctrl.closeRegister);

export default router;
