import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || '/api';
const KEY  = import.meta.env.VITE_API_KEY  || '';

const api = axios.create({ baseURL: BASE });

// Attach auth header before every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  } else if (KEY) {
    config.headers['x-api-key'] = KEY;
  }
  return config;
});

// On 401, clear token so the app redirects to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.dispatchEvent(new Event('auth:logout'));
    }
    return Promise.reject(err);
  }
);

export default api;

export const login         = (email, password) =>
  axios.post(`${BASE}/auth/login`,          { email, password }).then(r => r.data);
export const signup        = (email, password, name) =>
  axios.post(`${BASE}/auth/signup`,         { email, password, name }).then(r => r.data);
export const resetPassword = (email, newPassword) =>
  axios.post(`${BASE}/auth/reset-password`, { email, newPassword }).then(r => r.data);

export const getStats       = ()       => api.get('/stats').then(r => r.data);
export const getLeads       = (params) => api.get('/leads', { params }).then(r => r.data);
export const importLeads    = (leads)  => api.post('/leads/import', { leads }).then(r => r.data);
export const patchLead      = (id, d)  => api.patch(`/leads/${id}`, d).then(r => r.data);
export const deleteLead     = (id)     => api.delete(`/leads/${id}`).then(r => r.data);
export const exportLeadsCsv = () => {
  const token = localStorage.getItem('auth_token');
  return token ? `${BASE}/leads/export?token=${token}` : `${BASE}/leads/export?apiKey=${KEY}`;
};

export const getConnections    = (p)    => api.get('/connections', { params: p }).then(r => r.data);
export const patchConnection   = (id, d) => api.patch(`/connections/${id}`, d).then(r => r.data);
export const getActivity       = ()     => api.get('/connections/activity').then(r => r.data);
export const getAutomationRuns = ()     => api.get('/automation/runs').then(r => r.data);
