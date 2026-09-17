import api from './axios';

export const siteService = {
  list: (params) => api.get('/sites', { params }),
  get: (id) => api.get(`/sites/${id}`),
  create: (data) => api.post('/sites', data),
  update: (id, data) => api.put(`/sites/${id}`, data),
  remove: (id) => api.delete(`/sites/${id}`),
};