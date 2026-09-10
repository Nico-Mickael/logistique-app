import api from './axios';

export const pushService = {
  config: () => api.get('/push/config'),
  subscriptions: () => api.get('/push/subscriptions'),
  subscribe: (subscription, device) => api.post('/push/subscribe', { subscription, device }),
  unsubscribe: (endpoint) => api.delete('/push/subscribe', { data: { endpoint } }),
  sendTest: () => api.post('/push/test'),
};