import api from './axios';

export const vehicleService = {
  getAll: () => api.get('/vehicles'),
  getAvailable: () => api.get('/vehicles/available'),
  getOccupancy: () => api.get('/vehicles/occupancy'),
  create: (payload) => api.post('/vehicles', payload),
  update: (id, payload) => api.patch(`/vehicles/${id}`, payload),
};