import { apiRequest } from '../../shared/lib/dashboard/api.js';

/**
 * Deliveries Repository (1:1 mapping with back-end/express/modules/deliveries)
 * Handles all network requests for delivery domain.
 */
export const deliveriesRepo = {
  /** GET /deliveries */
  async list(query = {}) {
    return apiRequest('/deliveries', { query });
  },

  /** GET /deliveries/:id */
  async getById(id) {
    return apiRequest(`/deliveries/${encodeURIComponent(String(id))}`);
  },

  /** GET /deliveries/order/:orderId */
  async getByOrderId(orderId) {
    return apiRequest(`/deliveries/order/${encodeURIComponent(String(orderId))}`);
  },

  /** POST /deliveries */
  async create(body) {
    return apiRequest('/deliveries', { method: 'POST', body });
  },

  /** POST /deliveries/:id/status (Transition: Assigned, Dispatched, Out for Delivery, Delivered, Failed Attempt) */
  async transition(id, body) {
    return apiRequest(`/deliveries/${encodeURIComponent(String(id))}/status`, {
      method: 'POST',
      body,
    });
  },

  /** PUT /deliveries/:id (Edit details: partner, vehicle, eta, customer details) */
  async update(id, body) {
    return apiRequest(`/deliveries/${encodeURIComponent(String(id))}`, {
      method: 'PUT',
      body,
    });
  },

  /** DELETE /deliveries/:id */
  async remove(id) {
    return apiRequest(`/deliveries/${encodeURIComponent(String(id))}`, {
      method: 'DELETE',
    });
  },
};
