import api from './axios';

export const sortieService = {
  getAll: (params) => api.get('/sorties', { params }),
  mine: () => api.get('/sorties/mine'),
  planned: () => api.get('/sorties/planned'),
  join: (id, nb_personnes, destination) => api.post(`/sorties/${id}/join`, { nb_personnes, destination }),
  create: (payload) => api.post('/sorties', payload),
  lastForVehicle: (vehicleId) => api.get(`/sorties/last/${vehicleId}`),
  suggestions: (id) => api.get(`/sorties/${id}/suggestions`),
  addRequest: (id, request_id) => api.post(`/sorties/${id}/add-request`, { request_id }),
  depart: (id, departure_km) => api.patch(`/sorties/${id}/depart`, { departure_km }),
  arrivee: (id, data) => api.patch(`/sorties/${id}/arrivee`, data),
  employeeReturn: (id, departure_km, return_km, returned_at) => api.patch(`/sorties/${id}/return`, { departure_km, return_km, returned_at }),
  validateReturn: (id, force) => api.patch(`/sorties/${id}/validate-return`, force ? { force: true } : {}),
  update: (id, payload) => api.put(`/sorties/${id}`, payload),
  remove: (id) => api.delete(`/sorties/${id}`),
  removeBulk: (ids) => api.delete('/sorties/bulk', { data: { ids } }),
  driverMine: () => api.get('/sorties/driver/mine'),
  driverDepart: (id, departure_km) => api.patch(`/sorties/${id}/driver/depart`, { departure_km }),
  driverArrivee: (id, data) => api.patch(`/sorties/${id}/driver/arrivee`, data),
};