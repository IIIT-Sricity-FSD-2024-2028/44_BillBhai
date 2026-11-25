import { api } from '../../shared/lib/http.js';

/**
 * 1:1 frontend repository for backend `companies` module (`/api/companies`).
 */
export const companiesRepo = {
  register: (body) =>
    api('/companies/register', { method: 'POST', anonymous: true, body }),

  getAll: () => api('/companies'),

  getMyProfile: () => api('/companies/me/profile'),

  getById: (id) => api(`/companies/${encodeURIComponent(String(id))}`),

  create: (body) => api('/companies', { method: 'POST', body }),

  update: (id, body) =>
    api(`/companies/${encodeURIComponent(String(id))}`, { method: 'PUT', body }),

  changePlan: (id, plan) =>
    api(`/companies/${encodeURIComponent(String(id))}/plan`, {
      method: 'POST',
      body: { plan },
    }),

  cancelSubscription: (id) =>
    api(`/companies/${encodeURIComponent(String(id))}/cancel-subscription`, {
      method: 'POST',
      body: {},
    }),

  remove: (id) =>
    api(`/companies/${encodeURIComponent(String(id))}`, { method: 'DELETE' }),

  getCompanyActivity: (companyId, limit = 20) =>
    api('/activity', {
      query: { companyId, entity: 'company', entityId: companyId, limit },
    }),
};
