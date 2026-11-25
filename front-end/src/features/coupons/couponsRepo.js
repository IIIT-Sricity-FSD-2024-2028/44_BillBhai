import { api } from '../../shared/lib/http.js';

/** Repository for /api/coupons endpoints (1:1 with back-end/express/modules/coupons). */
export const couponsRepo = {
  /**
   * Lists coupons scoped to the active business.
   * @param {{ companyId?: string }} [query]
   * @returns {Promise<Array<Object>>}
   */
  async getAll(query) {
    const data = await api('/coupons', { query });
    return Array.isArray(data) ? data : [];
  },

  /**
   * Fetches a single coupon by ID.
   * @param {string} id
   * @returns {Promise<Object>}
   */
  getById(id) {
    return api(`/coupons/${encodeURIComponent(String(id))}`);
  },

  /**
   * Fetches coupon usage analytics for the active business.
   * @param {{ companyId?: string, from?: string, to?: string }} [query]
   * @returns {Promise<Object>}
   */
  getAnalytics(query) {
    return api('/coupons/analytics', { query });
  },

  /**
   * Validates a coupon code against an order subtotal and optional customer info.
   * @param {{ code: string, subtotal: number, customerPhone?: string, customerId?: string, companyId?: string }} body
   * @returns {Promise<Object>}
   */
  validate(body) {
    return api('/coupons/validate', { method: 'POST', body });
  },

  /**
   * Creates a new coupon.
   * @param {Object} body
   * @returns {Promise<Object>}
   */
  create(body) {
    return api('/coupons', { method: 'POST', body });
  },

  /**
   * Updates an existing coupon with optional optimistic version check.
   * @param {string} id
   * @param {Object} body
   * @returns {Promise<Object>}
   */
  update(id, body) {
    return api(`/coupons/${encodeURIComponent(String(id))}`, { method: 'PUT', body });
  },

  /**
   * Deletes an unused coupon, or deactivates a coupon that has already been used in orders.
   * @param {string} id
   * @returns {Promise<{ message: string, coupon?: Object, deactivated?: boolean }>}
   */
  remove(id) {
    return api(`/coupons/${encodeURIComponent(String(id))}`, { method: 'DELETE' });
  },
};
