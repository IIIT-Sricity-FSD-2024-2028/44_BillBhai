import { api } from '../lib/http.js';

/** Repository for /api/reports endpoints (1:1 with back-end/express/modules/reports). */
export const reportsRepo = {
  /**
   * Fetches the sales report scoped to the active business.
   * @param {{ companyId?: string, from?: string, to?: string }} [query]
   * @returns {Promise<Object>}
   */
  getSales(query) {
    return api('/reports/sales', { query });
  },

  /**
   * Fetches the inventory report scoped to the active business.
   * @param {{ companyId?: string }} [query]
   * @returns {Promise<Object>}
   */
  getInventory(query) {
    return api('/reports/inventory', { query });
  },

  /**
   * Fetches the returns report scoped to the active business.
   * @param {{ companyId?: string, from?: string, to?: string }} [query]
   * @returns {Promise<Object>}
   */
  getReturns(query) {
    return api('/reports/returns', { query });
  },
};
