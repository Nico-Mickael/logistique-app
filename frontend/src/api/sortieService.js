import api from './axios';

export const sortieService = {
  getAll: (params) => api.get('/sorties', { params }),
  mine: () => api.get('/sorties/mine'),
  planned: () => api.get('/sorties/planned'),
  join: (id, nb_personnes) => api.post(`/sorties/${id}/join`, { nb_personnes }),
  create: (payload) => api.post('/sorties', payload),
  lastForVehicle: (vehicleId) => api.get(`/sorties/last/${vehicleId}`),
  suggestions: (id) => api.get(`/sorties/${id}/suggestions`),
  addRequest: (id, request_id) => api.post(`/sorties/${id}/add-request`, { request_id }),
  depart: (id, departure_km) => api.patch(`/sorties/${id}/depart`, { departure_km }),
  arrivee: (id, arrival_km) => api.patch(`/sorties/${id}/arrivee`, { arrival_km }),
  employeeReturn: (id, departure_km, return_km, returned_at) => api.patch(`/sorties/${id}/return`, { departure_km, return_km, returned_at }),
  validateReturn: (id) => api.patch(`/sorties/${id}/validate-return`),
  update: (id, payload) => api.put(`/sorties/${id}`, payload),
  remove: (id) => api.delete(`/sorties/${id}`),
  driverMine: () => api.get('/sorties/driver/mine'),
  driverDepart: (id, departure_km) => api.patch(`/sorties/${id}/driver/depart`, { departure_km }),
  driverArrivee: (id, arrival_km) => api.patch(`/sorties/${id}/driver/arrivee`, { arrival_km }),
};