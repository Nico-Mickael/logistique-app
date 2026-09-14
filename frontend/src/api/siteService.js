import api from './axios';

export const siteService = {
  list: () => api.get('/sites'),
  get: (id) => api.get(`/sites/${id}`),
  create: (data) => api.post('/sites', data),
  update: (id, data) => api.put(`/sites/${id}`, data),
  remove: (id) => api.delete(`/sites/${id}`),
};