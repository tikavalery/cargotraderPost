import api from '../api';

export const subscriptionApi = {
  listPlans: () => api.get('/subscriptions/plans', { params: { _: Date.now() } }),
  current: () => api.get('/subscriptions/current'),
  usage: () => api.get('/subscriptions/usage'),
  /** Smart upgrade: Checkout (new), in-place update, or portal (past_due). */
  createCheckoutSession: (data) => api.post('/subscriptions/create-checkout-session', data),
  changePlan: (data) => api.post('/subscriptions/change-plan', data),
  confirmCheckout: (data) => api.post('/subscriptions/confirm-checkout', data),
  sync: () => api.post('/subscriptions/sync'),
  downgrade: (data) => api.post('/subscriptions/downgrade', data),
  selectFree: (data) => api.post('/subscriptions/select-free', data)
};
