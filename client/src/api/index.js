import axios from 'axios';

/**
 * API origin for split deploys (Vercel UI → Railway API).
 * Leave unset in local Vite so requests go through the `/api` proxy.
 * Example production: https://your-api.up.railway.app
 */
const API_ORIGIN = String(import.meta.env.VITE_API_URL || '')
  .trim()
  .replace(/\/$/, '');

export const apiBaseURL = API_ORIGIN ? `${API_ORIGIN}/api` : '/api';

const api = axios.create({
  baseURL: apiBaseURL,
  headers: { 'Content-Type': 'application/json' }
});

function resolveBusinessId() {
  try {
    const user = JSON.parse(localStorage.getItem('afritrade_user') || 'null');
    const stored = localStorage.getItem('afritrade_business_id');
    if (user?.defaultBusinessId) {
      if (stored !== user.defaultBusinessId) {
        localStorage.setItem('afritrade_business_id', user.defaultBusinessId);
      }
      return user.defaultBusinessId;
    }
    return stored || null;
  } catch {
    return localStorage.getItem('afritrade_business_id');
  }
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('afritrade_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const businessId = resolveBusinessId();
  if (businessId) config.headers['X-Business-Id'] = businessId;
  return config;
});

let refreshPromise = null;

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('afritrade_refresh_token');
  if (!refreshToken) return null;
  const res = await axios.post(`${apiBaseURL}/auth/refresh`, { refreshToken });
  localStorage.setItem('afritrade_token', res.data.token);
  if (res.data.refreshToken) localStorage.setItem('afritrade_refresh_token', res.data.refreshToken);
  return res.data.token;
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config || {};
    const url = original.url || '';
    const isAuthRoute =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/google') ||
      url.includes('/auth/forgot-password') ||
      url.includes('/auth/reset-password');

    if (err.response?.status === 401 && !original._retry && !isAuthRoute) {
      original._retry = true;
      try {
        refreshPromise = refreshPromise || refreshAccessToken();
        const token = await refreshPromise;
        refreshPromise = null;
        if (token) {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        }
      } catch {
        refreshPromise = null;
      }
      localStorage.removeItem('afritrade_token');
      localStorage.removeItem('afritrade_refresh_token');
      localStorage.removeItem('afritrade_user');
      localStorage.removeItem('afritrade_business_id');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('afritrade:session-cleared'));
      }
    }

    const message = err.response?.data?.message || '';
    const isBusinessError =
      (err.response?.status === 403 && /business/i.test(message)) ||
      (err.response?.status === 400 && /business context/i.test(message));
    if (isBusinessError && !original._businessRetry) {
      original._businessRetry = true;
      localStorage.removeItem('afritrade_business_id');
      const businessId = resolveBusinessId();
      if (businessId) original.headers['X-Business-Id'] = businessId;
      else delete original.headers['X-Business-Id'];
      return api(original);
    }

    return Promise.reject(err);
  }
);

export default api;

/** Backend connection check */
export const healthApi = {
  check: () => api.get('/health')
};

/** Auth */
export const authApi = {
  login: (data) => api.post('/auth/login', data),
  google: (data) => api.post('/auth/google', data),
  googleConfig: () => api.get('/auth/google/config'),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  validateResetToken: (token) => api.get(`/auth/reset-password/${encodeURIComponent(token)}`),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  register: (data) => api.post('/auth/register', data),
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout')
};

/** Businesses & users */
export const businessApi = {
  list: () => api.get('/businesses'),
  get: (id) => api.get(`/businesses/${id}`),
  create: (data) => api.post('/businesses', data),
  update: (id, data) => api.put(`/businesses/${id}`, data),
  /** Owner-only: permanently delete business + all data */
  remove: (id, data) => api.delete(`/businesses/${id}`, { data })
};

export const userApi = {
  profile: () => api.get('/users/me/profile'),
  updateProfile: (data) => api.put('/users/me/profile', data)
};

/** v2 REST resources */
export const itemsApi = {
  list: (params) => api.get('/items', { params }),
  get: (id) => api.get(`/items/${id}`),
  create: (data) => api.post('/items', data),
  update: (id, data) => api.put(`/items/${id}`, data),
  remove: (id) => api.delete(`/items/${id}`)
};


export const warehousesApi = {
  list: () => api.get('/warehouses'),
  get: (id) => api.get(`/warehouses/${id}`),
  create: (data) => api.post('/warehouses', data),
  update: (id, data) => api.put(`/warehouses/${id}`, data),
  remove: (id) => api.delete(`/warehouses/${id}`),
  kpis: () => api.get('/warehouses/kpis'),
  stock: (id, params) => api.get(`/warehouses/${id}/stock`, { params }),
  addStock: (id, data) => api.post(`/warehouses/${id}/stock`, data),
  updateStock: (id, itemId, data) => api.put(`/warehouses/${id}/stock/${itemId}`, data),
  deleteStock: (id, itemId) => api.delete(`/warehouses/${id}/stock/${itemId}`),
  logs: (id) => api.get(`/warehouses/${id}/logs`),
  transfer: (data) => api.post('/warehouses/transfer', data)
};

export const purchasesApi = {
  list: (params) => api.get('/purchases', { params }),
  get: (id) => api.get(`/purchases/${id}`),
  create: (data) => api.post('/purchases', data),
  bulkCreate: (data) => api.post('/purchases/bulk-create', data),
  update: (id, data) => api.put(`/purchases/${id}`, data),
  bulkUpdate: (ids, updates) => api.patch('/purchases/bulk', { ids, updates }),
  remove: (id) => api.delete(`/purchases/${id}`),
  bulkDelete: (ids) => api.delete('/purchases/bulk', { data: { ids } })
};

export const suppliersApi = {
  list: (params) => api.get('/suppliers', { params }),
  get: (id) => api.get(`/suppliers/${id}`),
  create: (data) => api.post('/suppliers', data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
  remove: (id) => api.delete(`/suppliers/${id}`),
  bulkDelete: (ids) => api.delete('/suppliers/bulk', { data: { ids } })
};

export const shipmentsApi = {
  list: (params) => api.get('/shipments', { params }),
  get: (id) => api.get(`/shipments/${id}`),
  create: (data) => api.post('/shipments', data),
  update: (id, data) => api.put(`/shipments/${id}`, data),
  remove: (id) => api.delete(`/shipments/${id}`),
  updateStatus: (id, data) => api.patch(`/shipments/${id}/status`, data)
};

export const salesApi = {
  list: (params) => api.get('/sales', { params }),
  get: (id) => api.get(`/sales/${id}`),
  create: (data) => api.post('/sales', data),
  update: (id, data) => api.put(`/sales/${id}`, data),
  remove: (id) => api.delete(`/sales/${id}`)
};

export const notificationsApi = {
  list: (params) => api.get('/notifications', { params }),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
  remove: (id) => api.delete(`/notifications/${id}`)
};

/** Inventory — Individual Items (SRS endpoints) */
export const inventoryItemsApi = {
  list: (params) => api.get('/inventory/items', { params }),
  get: (id) => api.get(`/inventory/items/${id}`),
  create: (data) => api.post('/inventory/items', data),
  update: (id, data) => api.put(`/inventory/items/${id}`, data),
  remove: (id) => api.delete(`/inventory/items/${id}`),
  bulkDelete: (ids) => api.delete('/inventory/items', { data: { ids } }),
  bulkUpdate: (ids, updates) => api.patch('/inventory/items/bulk', { ids, updates }),
  scan: (code) => api.get(`/inventory/items/scan/${encodeURIComponent(code)}`),
  stats: () => api.get('/inventory/stats'),
  suppliers: () => api.get('/suppliers'),
  locations: () => api.get('/locations'),
  groups: () => api.get('/inventory/groups'),
  createGroup: (data) => api.post('/inventory/groups', data),
  removeGroup: (name) => api.delete(`/inventory/groups/${encodeURIComponent(name)}`),
  activityLog: (params) => api.get('/inventory/activity-log', { params })
};
export const inventoryApi = {
  summary: () => api.get('/inventory/summary'),
  items: (params) => api.get('/inventory/items', { params }),
  createItem: (data) => api.post('/inventory/items', data)
};
export const posApi = {
  sales: (params) => api.get('/pos/sales', { params }),
  createSale: (data) => api.post('/pos/sales', data)
};
