/**
 * LeadForge — API Client
 * Handles all communication with the FastAPI backend.
 */
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 & 402 — redirect to login or show upgrade modal
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.includes('/auth/')) {
      localStorage.removeItem('access_token');
      window.location.href = '/auth/login';
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────
export const authAPI = {
  signup: (data) => api.post('/auth/signup', data),
  login: (data) => api.post('/auth/login', data),
  refresh: (token) => api.post('/auth/refresh', { refresh_token: token }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (email, newPassword) => api.post('/auth/reset-password', { email, new_password: newPassword }),
};

// ── Leads ─────────────────────────────────────────────────────────────
export const leadsAPI = {
  list: (params) => api.get('/leads', { params }),
  get: (id) => api.get(`/leads/${id}`),
  updateStatus: (id, status) => api.patch(`/leads/${id}`, { status }),
  contact: (id, data) => api.post(`/leads/${id}/contact`, data),
};

// ── Outreach ──────────────────────────────────────────────────────────
export const outreachAPI = {
  list: (params) => api.get('/outreach', { params }),
  create: (data) => api.post('/outreach', data),
  send: (id) => api.post(`/outreach/${id}/send`),
};

// ── Appointments ──────────────────────────────────────────────────────
export const appointmentsAPI = {
  list: () => api.get('/appointments'),
  create: (data) => api.post('/appointments', data),
  cancel: (id) => api.delete(`/appointments/${id}`),
};

// ── Follow-ups ────────────────────────────────────────────────────────
export const followupsAPI = {
  list: () => api.get('/followups'),
  trigger: (id) => api.post(`/followups/${id}/trigger`),
};

// ── Reviews ───────────────────────────────────────────────────────────
export const reviewsAPI = {
  list: () => api.get('/reviews'),
  request: (leadId) => api.post('/reviews/request', { lead_id: leadId }),
};

// ── Referrals ─────────────────────────────────────────────────────────
export const referralsAPI = {
  list: () => api.get('/referrals'),
  create: (data) => api.post('/referrals', data),
};

// ── Subscriptions ─────────────────────────────────────────────────────
export const subscriptionsAPI = {
  listPlans: () => api.get('/subscriptions/plans'),
  createCheckout: (data) => api.post('/subscriptions/create-checkout', data),
  current: () => api.get('/subscriptions/current'),
};

// ── Users ─────────────────────────────────────────────────────────────
export const usersAPI = {
  getMe: () => api.get('/users/me'),
  updateMe: (data) => api.patch('/users/me', data),
  updateZipCodes: (zipCodes) => api.put('/users/zip-codes', zipCodes),
  updateTrades: (trades) => api.put('/users/trades', trades),
  upgrade: (tier) => api.post('/users/upgrade', { tier }),
};

// ── Trial ─────────────────────────────────────────────────────────────
export const trialAPI = {
  status: () => api.get('/leads/trial-status'),
};

// ── Intake (chat widget + phone calls) ────────────────────────────────
export const intakeAPI = {
  startSession:  (source = 'chat') => api.post('/intake/chat/start', { source }),
  sendMessage:   (sessionId, message) =>
    api.post('/intake/chat/message', { session_id: sessionId, message }),
  listLeads:     (params) => api.get('/intake/leads', { params }),
  getLead:       (id) => api.get(`/intake/leads/${id}`),
  updateStatus:  (id, status) => api.patch(`/intake/leads/${id}/status`, { status }),
  simulateCall:  () => api.post('/intake/test/simulate-call'),
};

export default api;