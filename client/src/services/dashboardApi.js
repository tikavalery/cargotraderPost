import api from '../api';

export const dashboardApi = {
  summary: (params) => api.get('/dashboard/summary', { params })
};
