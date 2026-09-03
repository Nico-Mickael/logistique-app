import api from './axios';

export const maintenanceService = {
  list: (params) => api.get('/maintenances', { params }),
  due: (params) => api.get('/maintenances/due', { params }),
  create: (payload) => api.post('/maintenances', payload),
  update: (id, payload) => api.patch(`/maintenances/${id}`, payload),
  remove: (id) => api.delete(`/maintenances/${id}`),
  recordFuel: (sortieId, payload) => api.patch(`/maintenances/sorties/${sortieId}/fuel`, payload),
};
