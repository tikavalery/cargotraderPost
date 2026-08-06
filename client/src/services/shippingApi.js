import api from '../api';

export const shippingApi = {
  list: (params) => api.get('/shipping/shipments', { params }),
  get: (id) => api.get(`/shipping/shipments/${id}`),
  getItems: (id, params) => api.get(`/shipping/shipments/${id}/items`, { params }),
  getLandedCost: (id) => api.get(`/shipping/shipments/${id}/landed-cost`),
  saveLandedCost: (id, data) => api.put(`/shipping/shipments/${id}/landed-cost`, data),
  create: (data) => api.post('/shipping/shipments', data),
  update: (id, data) => api.put(`/shipping/shipments/${id}`, data),
  remove: (id) => api.delete(`/shipping/shipments/${id}`),
  updateStatus: (id, data) => api.patch(`/shipping/shipments/${id}/status`, data),
  complete: (id, data) => api.post(`/shipping/shipments/${id}/complete`, data),
  patchCosts: (id, data) => api.patch(`/shipping/shipments/${id}/costs`, data),
  nextId: () => api.get('/shipping/shipments/next-id', {
    headers: { 'Cache-Control': 'no-cache' },
    params: { _t: Date.now() }
  }),
  stats: () => api.get('/shipping/stats'),
  documents: (params) => api.get('/shipping/documents', { params }),
  getDocument: (id) => api.get(`/shipping/documents/${id}`),
  downloadDocument: (id, { inline = false } = {}) =>
    api.get(`/shipping/documents/${id}/file`, {
      params: inline ? { inline: 1 } : undefined,
      responseType: 'blob'
    }),
  createDocument: (data) => api.post('/shipping/documents', data),
  updateDocument: (id, data) => api.put(`/shipping/documents/${id}`, data),
  deleteDocument: (id) => api.delete(`/shipping/documents/${id}`),
  getTracking: (id) => api.get(`/shipping/shipments/${id}/tracking`),
  refreshTracking: (id, { advanceMock = true } = {}) =>
    api.post(`/shipping/shipments/${id}/tracking/refresh`, { advanceMock })
};
