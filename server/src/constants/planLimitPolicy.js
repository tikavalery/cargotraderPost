/**
 * Downgrade / plan-limit policy (CargoTrader)
 *
 * Policy: GRANDFATHER + clear upgrade prompts
 * - Existing records remain fully usable (view + edit). We do NOT force-archive or delete.
 * - New creates are blocked when usage >= plan limit.
 * - After a downgrade, businesses may be temporarily over-limit; they keep data and see
 *   upgrade prompts until they reduce usage or upgrade.
 *
 * Alternatives considered (not used):
 * - read-only over-limit — too disruptive for daily ops
 * - force archive — data loss risk / surprise for customers
 */

export const PLAN_LIMIT_POLICY = 'grandfather';

export const PLAN_LIMIT_POLICY_SUMMARY =
  'Existing data is kept after a downgrade. New items cannot be added until you upgrade or reduce usage below your plan limit.';

/**
 * @param {number|null|undefined} limit
 * @param {number} used
 * @returns {{ atLimit: boolean, overLimit: boolean, canCreate: boolean }}
 */
export function evaluateLimit(limit, used = 0) {
  if (limit == null) {
    return { atLimit: false, overLimit: false, canCreate: true };
  }
  const n = Number(used) || 0;
  const overLimit = n > limit;
  const atLimit = n >= limit;
  return {
    atLimit,
    overLimit,
    canCreate: !atLimit
  };
}

export function overLimitCreateMessage(planName, limit, resourceLabel) {
  return (
    `Your ${planName} plan allows up to ${limit} ${resourceLabel}. ` +
    `Your existing ${resourceLabel} are kept, but you cannot add more until you upgrade or remove some.`
  );
}
