import api from './axios';

export const statsService = {
  mine: (params) => api.get('/stats/mine', { params }),
  overview: (params) => api.get('/stats/overview', { params }),
  kilometrage: (params) => api.get('/stats/kilometrage', { params }),
  fleet: (params) => api.get('/stats/fleet', { params }),
  sortiesPassengers: (params) => api.get('/stats/sorties-passengers', { params }),
};
