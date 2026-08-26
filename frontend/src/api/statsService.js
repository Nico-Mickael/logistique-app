import api from './axios';

export const statsService = {
  mine: (params) => api.get('/stats/mine', { params }),
  overview: (params) => api.get('/stats/overview', { params }),
  kilometrage: (params) => api.get('/stats/kilometrage', { params }),
};
