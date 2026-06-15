import axios from 'axios';

const API = axios.create({
  baseURL: 'https://teamsync-app-6guk.onrender.com/api',
});

export default API;