import ApiError, { asyncHandler } from '../utils/ApiError.js';
import Item from '../models/Item.js';
import { enforceInventoryItemLimit } from '../utils/inventoryPlanEnforcement.js';
import { planHasFeature } from '../constants/plans.js';
import {
  assertPlanFeature,
  assertWithinLimit,
  assertAiAnalysisAvailable,
  countBusinessUsers,
  countShipmentsThisYear,
  countStores,
  countWarehouses,
  effectivePlanId,
  getBusinessSubscription
} from '../services/subscriptionService.js';

/** Block route when plan does not include a module (purchases, shipping, pos). */
export function requirePlanFeature(featureKey) {
  return asyncHandler(async (req, res, next) => {
    await assertPlanFeature(req.businessId, featureKey);
    next();
  });
}

/** Attach subscription summary to request for optional use in controllers. */
export async function attachSubscription(req, res, next) {
  try {
    if (!req.businessId) {
      req.planId = null;
      return next();
    }
    const { subscription, planId } = await getBusinessSubscription(req.businessId);
    req.subscription = subscription;
    req.planId = planId;
    next();
  } catch (err) {
    next(err);
  }
}

export const enforceInventoryLimit = asyncHandler(async (req, res, next) => {
  await enforceInventoryItemLimit(req.businessId, Item);
  next();
});

export const enforceWarehouseLimit = asyncHandler(async (req, res, next) => {
  await assertWithinLimit(req.businessId, 'warehouses', () => countWarehouses(req.businessId));
  next();
});

export const enforceShipmentYearlyLimit = asyncHandler(async (req, res, next) => {
  await assertWithinLimit(req.businessId, 'shipmentsPerYear', () =>
    countShipmentsThisYear(req.businessId)
  );
  next();
});

export const enforceStoreLimit = asyncHandler(async (req, res, next) => {
  await assertWithinLimit(req.businessId, 'stores', () => countStores(req.businessId));
  next();
});

export const enforceUserLimit = asyncHandler(async (req, res, next) => {
  await assertWithinLimit(req.businessId, 'users', () => countBusinessUsers(req.businessId));
  next();
});

/** Block AI Purchase Assistant when monthly quota is exhausted. */
export const enforceAiAnalysisLimit = asyncHandler(async (req, res, next) => {
  await assertAiAnalysisAvailable(req.businessId);
  next();
});

/** Read-only check helper for controllers. */
export async function checkFeature(businessId, featureKey) {
  const { planId } = await getBusinessSubscription(businessId);
  return planHasFeature(planId, featureKey);
}

export { ApiError, effectivePlanId, getBusinessSubscription };
