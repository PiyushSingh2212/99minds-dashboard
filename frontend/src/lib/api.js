import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || '/api';
const KEY  = import.meta.env.VITE_API_KEY  || '';

const api = axios.create({
  baseURL: BASE,
  headers: { 'x-api-key': KEY },
});

export default api;

export const getStats       = () => api.get('/stats').then(r => r.data);
export const getLeads       = (params) => api.get('/leads', { params }).then(r => r.data);
export const importLeads    = (leads) => api.post('/leads/import', { leads }).then(r => r.data);
export const patchLead      = (id, data) => api.patch(`/leads/${id}`, data).then(r => r.data);
export const deleteLead     = (id) => api.delete(`/leads/${id}`).then(r => r.data);
export const exportLeadsCsv = () => `${BASE}/leads/export?apiKey=${KEY}`;

export const getConnections    = (params) => api.get('/connections', { params }).then(r => r.data);
export const patchConnection   = (id, data) => api.patch(`/connections/${id}`, data).then(r => r.data);
export const getActivity       = () => api.get('/connections/activity').then(r => r.data);
export const getAutomationRuns = () => api.get('/automation/runs').then(r => r.data);
