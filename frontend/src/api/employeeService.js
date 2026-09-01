import api from './axios';

export const employeeService = {
  listChauffeurs: () => api.get('/employees/chauffeurs'),
};
