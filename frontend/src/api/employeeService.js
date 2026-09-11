import api from './axios';

export const employeeService = {
  listChauffeurs: () => api.get('/employees/chauffeurs'),
  list: () => api.get('/employees'),
  create: (data) => api.post('/employees', data),
  update: (id, data) => api.put(`/employees/${id}`, data),
  remove: (id) => api.delete(`/employees/${id}`),
};
