import { api } from '../lib/http.js';

/**
 * 1:1 frontend repository for backend `customers` module (`/api/customers`).
 */
export const customersRepo = {
  findByPhone: async (phone) => {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(digits)) return null;
    try {
      return await api(`/customers/phone/${digits}`);
    } catch (error) {
      if (error && error.status === 404) return null;
      throw error;
    }
  },

  getAll: (query) => api('/customers', { query }),

  getById: (id) => api(`/customers/${encodeURIComponent(String(id))}`),

  create: (body) => api('/customers', { method: 'POST', body }),

  update: (id, body) =>
    api(`/customers/${encodeURIComponent(String(id))}`, { method: 'PUT', body }),

  remove: (id) =>
    api(`/customers/${encodeURIComponent(String(id))}`, { method: 'DELETE' }),
};
