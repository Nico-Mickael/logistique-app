import api from './axios';

export const vehicleService = {
  getAll: () => api.get('/vehicles'),
  getOccupancy: () => api.get('/vehicles/occupancy'),
  create: (payload) => api.post('/vehicles', payload),
  update: (id, payload) => api.patch(`/vehicles/${id}`, payload),
  remove: (id) => api.delete(`/vehicles/${id}`),
};