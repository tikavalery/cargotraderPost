import Subscription from '../models/Subscription.js';
import Item from '../models/Item.js';
import ApiError from './ApiError.js';
import { getPlan, getPlanLimit } from '../constants/plans.js';
import { overLimitCreateMessage } from '../constants/planLimitPolicy.js';
import { effectivePlanId } from './planHelpers.js';
import { inventoryItemLimitQuery } from './inventoryLimitFilter.js';

/**
 * Enforce per-plan inventory item cap (loose items with qty > 0).
 * Grandfather policy: existing items stay; only new creates are blocked at/over limit.
 * @param {string} businessId
 * @param {{ countDocuments: Function }} [ItemModel]
 */
export async function enforceInventoryItemLimit(businessId, ItemModel = Item) {
  if (process.env.SKIP_PLAN_LIMITS === 'true') return;
  if (!businessId) {
    throw new ApiError(400, 'Business context required to add inventory items');
  }

  const count = await ItemModel.countDocuments(inventoryItemLimitQuery(businessId));
  const sub = await Subscription.findOne({ business: businessId });
  const planId = effectivePlanId(sub || { plan: 'free', status: 'active' });
  const limit = getPlanLimit(planId, 'inventoryItems');

  if (limit == null) return;

  if (count >= limit) {
    const plan = getPlan(planId);
    throw new ApiError(403, overLimitCreateMessage(plan.name, limit, 'inventory items'));
  }
}
