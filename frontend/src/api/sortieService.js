import api from './axios';

export const sortieService = {
  getAll: (params) => api.get('/sorties', { params }),
  create: (payload) => api.post('/sorties', payload),
  lastForVehicle: (vehicleId) => api.get(`/sorties/last/${vehicleId}`),
  suggestions: (id) => api.get(`/sorties/${id}/suggestions`),
  addRequest: (id, request_id) => api.post(`/sorties/${id}/add-request`, { request_id }),
  updateStatus: (id, status) => api.patch(`/sorties/${id}/status`, { status }),
  depart: (id, departure_km) => api.patch(`/sorties/${id}/depart`, { departure_km }),
  arrivee: (id, arrival_km) => api.patch(`/sorties/${id}/arrivee`, { arrival_km }),
  employeeReturn: (id, return_km, returned_at) => api.patch(`/sorties/${id}/return`, { return_km, returned_at }),
  validateReturn: (id) => api.patch(`/sorties/${id}/validate-return`),
  update: (id, payload) => api.put(`/sorties/${id}`, payload),
  remove: (id) => api.delete(`/sorties/${id}`),
};