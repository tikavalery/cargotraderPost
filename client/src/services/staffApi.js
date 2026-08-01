import api from '../api';

export const staffApi = {
  listUsers: () => api.get('/users'),
  getUser: (id) => api.get(`/users/${id}`),
  updateUser: (id, data) => api.put(`/users/${id}`, data),
  deleteUser: (id) => api.delete(`/users/${id}`),
  listInvitations: () => api.get('/invitations'),
  getInvitation: (id) => api.get(`/invitations/${id}`),
  listRoles: () => api.get('/invitations/roles'),
  invite: (data) => api.post('/invitations', data),
  updateInvitation: (id, data) => api.put(`/invitations/${id}`, data),
  revokeInvitation: (id) => api.delete(`/invitations/${id}`),
  resendInvitation: (id) => api.post(`/invitations/${id}/resend`),
  previewInvitation: (token) => api.get(`/invitations/token/${token}`),
  acceptInvitation: (data) => api.post('/invitations/accept', data)
};
