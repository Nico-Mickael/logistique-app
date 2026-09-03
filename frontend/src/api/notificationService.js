import api from './axios';

export const notificationService = {
  mine: (params) => api.get('/notifications/mine', { params }),
  unreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
  remove: (id) => api.delete(`/notifications/${id}`),
};
