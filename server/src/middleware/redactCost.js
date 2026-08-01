import { canViewCost, redactCostPayload } from '../utils/costRedaction.js';

/** Strip cost fields from JSON responses for roles without viewCost. */
export function redactCostResponse(req, res, next) {
  const role = req.businessRole || req.userDoc?.role || req.user?.role;
  if (canViewCost(role)) return next();

  const originalJson = res.json.bind(res);
  res.json = (body) => originalJson(redactCostPayload(body, role));
  next();
}
