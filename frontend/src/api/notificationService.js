import api from './axios';

export const notificationService = {
  mine: () => api.get('/notifications/mine'),
  markAsRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};