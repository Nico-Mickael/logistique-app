import api from './axios';

export const requestService = {
  create: (payload) => api.post('/requests', payload),
  mine: () => api.get('/requests/mine'),
  all: (params) => api.get('/requests', { params }),
  updateStatus: (id, status, new_date) => api.patch(`/requests/${id}/status`, { status, new_date }),
  cancel: (id) => api.patch(`/requests/${id}/cancel`),
  respondReschedule: (id, accepted) => api.patch(`/requests/${id}/reschedule/respond`, { accepted }),
  update: (id, payload) => api.put(`/requests/${id}`, payload),
};