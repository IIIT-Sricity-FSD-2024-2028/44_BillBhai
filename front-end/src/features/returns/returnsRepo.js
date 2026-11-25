import { apiRequest } from '../../shared/lib/dashboard/api.js';

/**
 * Returns Repository (1:1 mapping with back-end/express/modules/returns)
 * Handles all network requests for the returns and refunds domain.
 */
export const returnsRepo = {
  /** GET /returns */
  async list(query = {}) {
    return apiRequest('/returns', { query });
  },

  /** GET /returns/:id */
  async getById(id) {
    return apiRequest(`/returns/${encodeURIComponent(String(id))}`);
  },

  /** GET /returns/order/:orderId/returnable */
  async getReturnableByOrderId(orderId) {
    return apiRequest(`/returns/order/${encodeURIComponent(String(orderId))}/returnable`);
  },

  /** POST /returns */
  async create(body) {
    return apiRequest('/returns', { method: 'POST', body });
  },

  /** POST /returns/:id/status (Transition: Approve, Reject, Refund, Exchange) */
  async transition(id, body) {
    return apiRequest(`/returns/${encodeURIComponent(String(id))}/status`, {
      method: 'POST',
      body,
    });
  },

  /** PUT /returns/:id */
  async update(id, body) {
    return apiRequest(`/returns/${encodeURIComponent(String(id))}`, {
      method: 'PUT',
      body,
    });
  },

  /** DELETE /returns/:id */
  async remove(id) {
    return apiRequest(`/returns/${encodeURIComponent(String(id))}`, {
      method: 'DELETE',
    });
  },
};
