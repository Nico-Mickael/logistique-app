import api from './axios';

export const statsService = {
  overview: (params) => api.get('/stats/overview', { params }),
  kilometrage: (params) => api.get('/stats/kilometrage', { params }),
};
