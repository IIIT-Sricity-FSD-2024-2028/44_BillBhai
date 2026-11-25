import { api } from '../../shared/lib/http.js';

/** Repository for /api/products endpoints (1:1 with back-end/express/modules/products). */
export const productsRepo = {
  /**
   * Lists products scoped to the active business.
   * @param {{ category?: string, companyId?: string, includeInactive?: string|boolean }} [query]
   * @returns {Promise<Array<Object>>}
   */
  async getAll(query) {
    const normalizedQuery = query
      ? {
          ...query,
          includeInactive:
            query.includeInactive !== undefined ? String(query.includeInactive) : undefined,
        }
      : undefined;
    const data = await api('/products', { query: normalizedQuery });
    return Array.isArray(data) ? data : [];
  },

  /**
   * Fetches a single product by ID.
   * @param {string} id
   * @returns {Promise<Object>}
   */
  getById(id) {
    return api(`/products/${encodeURIComponent(String(id))}`);
  },

  /**
   * Fetches distinct active product categories.
   * @param {{ companyId?: string }} [query]
   * @returns {Promise<Array<string>>}
   */
  async getCategories(query) {
    const data = await api('/products/categories', { query });
    return Array.isArray(data) ? data : [];
  },

  /**
   * Looks up a product by exact barcode.
   * @param {string} barcode
   * @param {{ companyId?: string }} [query]
   * @returns {Promise<Object>}
   */
  getByBarcode(barcode, query) {
    return api(`/products/barcode/${encodeURIComponent(String(barcode))}`, { query });
  },

  /**
   * Creates a product (and its paired backend inventory row).
   * @param {Object} body
   * @returns {Promise<Object>}
   */
  create(body) {
    return api('/products', { method: 'POST', body });
  },

  /**
   * Updates mutable product fields with optional optimistic version check.
   * @param {string} id
   * @param {Object} body
   * @returns {Promise<Object>}
   */
  update(id, body) {
    return api(`/products/${encodeURIComponent(String(id))}`, { method: 'PUT', body });
  },

  /**
   * Soft-deactivates a product (preserves history/ledger).
   * @param {string} id
   * @returns {Promise<{ message: string, product: Object }>}
   */
  remove(id) {
    return api(`/products/${encodeURIComponent(String(id))}`, { method: 'DELETE' });
  },

  /**
   * Fetches audit activity entries for a specific product.
   * @param {string} productId
   * @param {{ companyId?: string, limit?: number }} [query]
   * @returns {Promise<Array<Object>>}
   */
  async getActivity(productId, query) {
    const data = await api('/activity', {
      query: { ...query, entity: 'product', entityId: productId, limit: query?.limit ?? 50 },
    });
    return Array.isArray(data) ? data : [];
  },
};
