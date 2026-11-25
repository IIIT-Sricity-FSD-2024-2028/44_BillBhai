import { api } from '../../shared/lib/http.js';

/** Repository for /api/suppliers endpoints (1:1 with back-end/express/modules/suppliers). */
export const suppliersRepo = {
  /**
   * Lists suppliers scoped to the active business with product counts.
   * @param {{ companyId?: string }} [query]
   * @returns {Promise<Array<Object>>}
   */
  async getAll(query) {
    const data = await api('/suppliers', { query });
    return Array.isArray(data) ? data : [];
  },

  /**
   * Fetches one supplier record by ID (SUP-xxx).
   * @param {string} id
   * @returns {Promise<Object>}
   */
  getById(id) {
    return api(`/suppliers/${encodeURIComponent(String(id))}`);
  },

  /**
   * Creates a supplier record.
   * @param {Object} body
   * @returns {Promise<Object>}
   */
  create(body) {
    return api('/suppliers', { method: 'POST', body });
  },

  /**
   * Updates supplier details with optional optimistic version check.
   * @param {string} id
   * @param {Object} body
   * @returns {Promise<Object>}
   */
  update(id, body) {
    return api(`/suppliers/${encodeURIComponent(String(id))}`, { method: 'PUT', body });
  },

  /**
   * Deletes an unlinked supplier record.
   * @param {string} id
   * @returns {Promise<{ message: string, supplier: Object }>}
   */
  remove(id) {
    return api(`/suppliers/${encodeURIComponent(String(id))}`, { method: 'DELETE' });
  },
};
