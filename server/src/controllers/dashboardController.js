import { asyncHandler } from '../utils/ApiError.js';
import { getDashboardSummary, refreshDashboardSummary } from '../services/dashboardAggregation.service.js';

export const summary = asyncHandler(async (req, res) => {
  const financePeriod = req.query.financePeriod || req.query.period || 'month';
  const currency =
    req.query.currency ||
    req.userDoc?.preferredCurrency ||
    req.userDoc?.currency ||
    'XAF';
  const data = await getDashboardSummary(req.businessId, { financePeriod, currency });
  res.json({ ok: true, data });
});

export const refresh = asyncHandler(async (req, res) => {
  const financePeriod = req.body?.financePeriod || req.query.financePeriod || 'month';
  const currency =
    req.body?.currency ||
    req.query.currency ||
    req.userDoc?.preferredCurrency ||
    req.userDoc?.currency ||
    'XAF';
  const data = await refreshDashboardSummary(req.businessId, { financePeriod, currency });
  res.json({ ok: true, data, message: 'Dashboard refreshed' });
});
