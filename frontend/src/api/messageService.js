import api from './axios';

export const messageService = {
  conversations: {
    list: () => api.get('/conversations'),
    detail: (id) => api.get(`/conversations/${id}`),
    create: (recipientId) => api.post('/conversations', { recipient_id: recipientId }),
    users: (search) => api.get('/conversations/users', { params: { search } }),
    messages: (id) => api.get(`/conversations/${id}/messages`),
    send: (id, content) => api.post(`/conversations/${id}/messages`, { content }),
    markRead: (id) => api.post(`/conversations/${id}/read`),
  },
  messages: {
    unreadCount: () => api.get('/messages/unread-count'),
    update: (id, content) => api.patch(`/messages/${id}`, { content }),
    remove: (id) => api.delete(`/messages/${id}`),
  },
};