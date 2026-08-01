import api from '../api';

export const stripeApi = {
  /** Create a Stripe Customer Portal session; returns { url } for redirect */
  createCustomerPortal: (data = {}) => api.post('/stripe/customer-portal', data)
};
