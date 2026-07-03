import api from './axios';

export const notificationService = {
  mine: () => api.get('/notifications/mine'),
  markAsRead: (id) => api.patch(`/notifications/${id}/read`),
};