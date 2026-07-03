import api from './axios';

export const sortieService = {
  getAll: () => api.get('/sorties'),
  create: (payload) => api.post('/sorties', payload),
  suggestions: (id) => api.get(`/sorties/${id}/suggestions`),
  addRequest: (id, request_id) => api.post(`/sorties/${id}/add-request`, { request_id }),
  updateStatus: (id, status) => api.patch(`/sorties/${id}/status`, { status }),
  depart: (id, departure_km) => api.patch(`/sorties/${id}/depart`, { departure_km }),
  arrivee: (id, arrival_km) => api.patch(`/sorties/${id}/arrivee`, { arrival_km }),
};