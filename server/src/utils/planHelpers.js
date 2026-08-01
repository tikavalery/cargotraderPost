const ACTIVE_STATUSES = new Set(['active', 'trialing']);

/** Plan used for feature limits and premium access checks */
export function effectivePlanId(subscription) {
  if (!subscription) return 'free';
  // During past_due (including grace), premium features are disabled — use Free tier
  if (subscription.status === 'past_due') return 'free';
  if (ACTIVE_STATUSES.has(subscription.status) || subscription.plan === 'free') {
    return subscription.plan;
  }
  return 'free';
}

/** Plan label shown in UI (may stay Professional/Enterprise while past_due) */
export function displayPlanId(subscription) {
  if (!subscription?.plan) return 'free';
  return subscription.plan;
}
