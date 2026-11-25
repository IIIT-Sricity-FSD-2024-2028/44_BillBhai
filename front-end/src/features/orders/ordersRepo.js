import { api } from '../../shared/lib/http.js';

/** Repository for /api/orders endpoints (1:1 with back-end/express/modules/orders). */
export const ordersRepo = {
  /**
   * Lists orders scoped to the active business.
   * @param {{ companyId?: string, status?: string, paymentMethod?: string, customerId?: string }} [query]
   * @returns {Promise<Array<Object>>}
   */
  async getAll(query) {
    const data = await api('/orders', { query });
    return Array.isArray(data) ? data : [];
  },

  /**
   * Fetches a single order by ID.
   * @param {string} id
   * @returns {Promise<Object>}
   */
  getById(id) {
    return api(`/orders/${encodeURIComponent(String(id))}`);
  },

  /**
   * Creates a new order (checkout, billing, and payment).
   * @param {Object} body
   * @returns {Promise<Object>}
   */
  create(body) {
    return api('/orders', { method: 'POST', body });
  },

  /**
   * Calculates a server-side quote (totals, tax, discounts) without placing an order.
   * @param {Object} body
   * @returns {Promise<Object>}
   */
  quote(body) {
    return api('/orders/quote', { method: 'POST', body });
  },

  /**
   * Validates promotion/coupon codes against a cart payload.
   * @param {Object} body
   * @returns {Promise<Object>}
   */
  validatePromotions(body) {
    return api('/orders/promotions/validate', { method: 'POST', body });
  },

  /**
   * Updates mutable order fields with optional optimistic version check.
   * @param {string} id
   * @param {Object} body
   * @returns {Promise<Object>}
   */
  update(id, body) {
    return api(`/orders/${encodeURIComponent(String(id))}`, { method: 'PUT', body });
  },

  /**
   * Cancels an order with a reason and optional optimistic version check.
   * @param {string} id
   * @param {Object} [body]
   * @returns {Promise<Object>}
   */
  cancel(id, body) {
    return api(`/orders/${encodeURIComponent(String(id))}/cancel`, { method: 'POST', body });
  },

  /**
   * Deletes an order record.
   * @param {string} id
   * @returns {Promise<Object>}
   */
  remove(id) {
    return api(`/orders/${encodeURIComponent(String(id))}`, { method: 'DELETE' });
  },

  /**
   * Lists all bills scoped to the active business.
   * @param {{ companyId?: string }} [query]
   * @returns {Promise<Array<Object>>}
   */
  async getAllBills(query) {
    const data = await api('/orders/bills/all', { query });
    return Array.isArray(data) ? data : [];
  },

  /**
   * Fetches a single bill by bill number.
   * @param {string} billNo
   * @returns {Promise<Object>}
   */
  getBillByNo(billNo) {
    return api(`/orders/bills/${encodeURIComponent(String(billNo))}`);
  },

  /**
   * Lists all payments scoped to the active business.
   * @param {{ companyId?: string }} [query]
   * @returns {Promise<Array<Object>>}
   */
  async getAllPayments(query) {
    const data = await api('/orders/payments/all', { query });
    return Array.isArray(data) ? data : [];
  },

  /**
   * Fetches a single payment record by bill number.
   * @param {string} billNo
   * @returns {Promise<Object>}
   */
  getPaymentByBillNo(billNo) {
    return api(`/orders/payments/${encodeURIComponent(String(billNo))}`);
  },
};
