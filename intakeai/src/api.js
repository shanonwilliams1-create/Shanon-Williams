import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({ baseURL: BASE, headers: { 'Content-Type': 'application/json' } });

export const intakeAPI = {
  startSession: (source = 'chat') => api.post('/intake/chat/start', { source }),
  sendMessage:  (sessionId, message) =>
    api.post('/intake/chat/message', { session_id: sessionId, message }),
};

export default api;
