import api from './axios';

export const requestService = {
  create: (payload) => api.post('/requests', payload),
  mine: () => api.get('/requests/mine'),
  all: (params) => api.get('/requests', { params }),
  toProcess: () => api.get('/requests/to-process'),
  assignVehicle: (id, vehicle_id) => api.post(`/requests/${id}/assign`, { vehicle_id }),
  updateStatus: (id, status, new_date, reschedule_reason) => api.patch(`/requests/${id}/status`, { status, new_date, reschedule_reason }),
  cancel: (id) => api.patch(`/requests/${id}/cancel`),
  respondReschedule: (id, accepted) => api.patch(`/requests/${id}/reschedule/respond`, { accepted }),
  update: (id, payload) => api.put(`/requests/${id}`, payload),
  remove: (id) => api.delete(`/requests/${id}`),
};