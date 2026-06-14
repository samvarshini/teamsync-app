import API from './api';

const getAuthHeader = () => {
  const user = JSON.parse(localStorage.getItem('user'));
  return { headers: { Authorization: `Bearer ${user.token}` } };
};

export const createTask = (data) => API.post('/tasks/create', data, getAuthHeader());
export const getTasksByTeam = (teamId) => API.get(`/tasks/team/${teamId}`, getAuthHeader());
export const updateTaskStatus = (taskId, status) => API.patch(`/tasks/${taskId}/status`, { status }, getAuthHeader());
export const deleteTask = (taskId) => API.delete(`/tasks/${taskId}`, getAuthHeader());