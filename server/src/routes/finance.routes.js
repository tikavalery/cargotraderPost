import { Router } from 'express';
import { protect, attachUser, businessContext, requireBusiness } from '../middleware/auth.js';
import { authorizePermission } from '../middleware/rbac.js';
import { requirePlanFeature, enforceAiAnalysisLimit } from '../middleware/planLimits.js';
import * as ctrl from '../controllers/financeController.js';

const router = Router();
router.use(protect, attachUser, businessContext, requireBusiness);

const viewAuth = authorizePermission('viewFinance');
const manageAuth = authorizePermission('manageFinance');

router.get('/dashboard', viewAuth, ctrl.dashboard);
router.get('/revenue/overview', viewAuth, ctrl.revenueOverview);
router.get('/revenue/summary', viewAuth, ctrl.revenueSummary);
router.get('/revenue/channels', viewAuth, ctrl.revenueChannels);
router.get('/revenue/trend', viewAuth, ctrl.revenueTrend);
router.get('/revenue/sales', viewAuth, ctrl.revenueSales);
router.get('/revenue/categories', viewAuth, ctrl.revenueCategories);
router.get('/revenue/warehouses', viewAuth, ctrl.revenueWarehouses);
router.get('/revenue/:id', viewAuth, ctrl.getRevenue);
router.get('/expenses/overview', viewAuth, ctrl.expensesOverview);
router.get('/expenses/summary', viewAuth, ctrl.expensesSummary);
router.get('/expenses/categories', viewAuth, ctrl.expensesCategories);
router.get('/expenses/trend', viewAuth, ctrl.expensesTrend);
router.get('/expenses/list', viewAuth, ctrl.expensesList);
router.get('/expenses/insights', viewAuth, ctrl.expensesInsights);
router.get('/expenses/:id', viewAuth, ctrl.getExpense);
router.get('/cash-flow', viewAuth, ctrl.cashFlow);
router.get('/cash-flow/:id', viewAuth, ctrl.getCashFlowEntry);
router.get('/exchange-rates', viewAuth, ctrl.exchangeRates);
router.get('/profit-loss', viewAuth, ctrl.profitLoss);
router.get('/export/excel', viewAuth, ctrl.exportData);
router.get('/export/pdf', viewAuth, ctrl.exportData);

router.post('/sync', manageAuth, ctrl.sync);
router.post('/revenue', manageAuth, ctrl.createRevenue);
router.put('/revenue/:id', manageAuth, ctrl.updateRevenue);
router.delete('/revenue/:id', manageAuth, ctrl.deleteRevenue);
router.post(
  '/expenses/analyze-image',
  manageAuth,
  requirePlanFeature('purchaseAiFill'),
  enforceAiAnalysisLimit,
  ctrl.analyzeExpenseImage
);
router.post('/expenses', manageAuth, ctrl.createExpense);
router.put('/expenses/:id', manageAuth, ctrl.updateExpense);
router.delete('/expenses/:id', manageAuth, ctrl.deleteExpense);
router.delete('/cash-flow/:id', manageAuth, ctrl.deleteCashFlowEntry);
router.post('/exchange-rates/convert', manageAuth, ctrl.convertRate);
router.post('/landed-cost/calculate', manageAuth, ctrl.landedCostCalculate);

export default router;
