import api from './axios';

export const requestService = {
  create: (payload) => api.post('/requests', payload),
  mine: () => api.get('/requests/mine'),
  all: () => api.get('/requests'),
  updateStatus: (id, status, new_date) => api.patch(`/requests/${id}/status`, { status, new_date }),
  respondReschedule: (id, accepted) => api.patch(`/requests/${id}/reschedule/respond`, { accepted }),
};