import api from '../api';

export const storesApi = {
  list: (params) => api.get('/stores', { params }),
  get: (storeId) => api.get(`/stores/${storeId}`),
  create: (data) => api.post('/stores', data),
  update: (storeId, data) => api.put(`/stores/${storeId}`, data),
  remove: (storeId) => api.delete(`/stores/${storeId}`),
  products: (storeId, params) => api.get(`/stores/${storeId}/products`, { params }),
  inventory: (storeId, params) => api.get(`/stores/${storeId}/inventory`, { params }),
  logs: (storeId) => api.get(`/stores/${storeId}/logs`),
  transferWarehouses: () => api.get('/stores/transfer-destinations/warehouses'),
  transferStores: (params) => api.get('/stores/transfer-destinations/stores', { params }),
  lookup: (code, storeId) => api.get('/stores/products/lookup', { params: { code, storeId } })
};

export const posApi = {
  customers: () => api.get('/pos/customers'),
  validatePromo: (code) => api.post('/pos/promo/validate', { code }),
  transactions: (params) => api.get('/pos/transactions', { params }),
  getTransaction: (id) => api.get(`/pos/transactions/${id}`),
  createTransaction: (data) => api.post('/pos/transactions', data),
  held: (params) => api.get('/pos/held', { params }),
  createHeld: (data) => api.post('/pos/held', data),
  resumeHeld: (heldId) => api.get(`/pos/held/${heldId}/resume`),
  deleteHeld: (heldId) => api.delete(`/pos/held/${heldId}`),
  processReturn: (data) => api.post('/pos/returns', data),
  salesReturns: (params) => api.get('/pos/sales-returns', { params }),
  getSalesReturn: (returnId) => api.get(`/pos/sales-returns/${returnId}`),
  deleteSalesReturn: (returnId) => api.delete(`/pos/sales-returns/${returnId}`),
  getReturnableTransaction: (transactionId) =>
    api.get(`/pos/transactions/${transactionId}/returnable`),
  register: (storeId) => api.get('/pos/register', { params: { storeId } }),
  closeRegister: (data) => api.patch('/pos/register/close', data),
  todayStats: (storeId) => api.get('/pos/stats/today', { params: { storeId } }),
  initiateMobileMoney: (data) => api.post('/pos/mobile-money/initiate', data),
  mobileMoneyStatus: (txRef) => api.get(`/pos/mobile-money/status/${encodeURIComponent(txRef)}`)
};
