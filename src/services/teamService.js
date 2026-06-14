import API from './api';

const getAuthHeader = () => {
  const user = JSON.parse(localStorage.getItem('user'));
  return { headers: { Authorization: `Bearer ${user.token}` } };
};

export const createTeam = (data) => API.post('/teams/create', data, getAuthHeader());
export const joinTeam = (inviteCode) => API.post('/teams/join', { inviteCode }, getAuthHeader());
export const getMyTeams = () => API.get('/teams/my', getAuthHeader());
