import { api } from '../lib/http.js';

/**
 * Maps an enriched backend inventory row to the front-end UI schema.
 * Single source of truth used across repositories, slices, and legacy bridge.
 *
 * @param {Object} row
 * @returns {Object}
 */
export function mapInventoryRow(row) {
  return {
    sku: String(row.productId || ''),
    inventoryId: String(row.id || ''),
    productId: String(row.productId || ''),
    version: row.version,
    productVersion: row.productVersion,
    name: String(row.productName || row.productId || ''),
    cat: String(row.category || 'Uncategorized'),
    supplier: String(row.supplierName || ''),
    supplierId: String(row.supplierId || ''),
    supplierContact: String(row.supplierContact || ''),
    supplierPhone: String(row.supplierPhone || ''),
    supplierEmail: String(row.supplierEmail || ''),
    leadTimeDays: row.leadTimeDays,
    moq: row.moq,
    stock: Math.max(0, Number(row.stockAvailable) || 0),
    price: Number(row.price) || 0,
    costPrice: row.costPrice,
    gstRate: Number(row.gstRate) || 0,
    barcode: String(row.barcode || ''),
    size: String(row.size || ''),
    active: row.active !== false,
    status: String(row.status || 'In Stock'),
    reorderLevel: Math.max(0, Number(row.reorderLevel) || 0),
    location: String(row.location || ''),
    lastUpdated: row.lastUpdated,
    updatedBy: row.updatedBy,
  };
}

/** Repository for /api/inventory endpoints (1:1 with back-end/express/modules/inventory). */
export const inventoryRepo = {
  /**
   * Lists all enriched inventory rows for the scoped business.
   * @param {{ companyId?: string }} [query]
   * @returns {Promise<Array<Object>>}
   */
  async getAll(query) {
    const data = await api('/inventory', { query });
    return Array.isArray(data) ? data.map(mapInventoryRow) : [];
  },

  /**
   * Fetches one enriched inventory record by inventory ID (INV-xxx).
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async getById(id) {
    const row = await api(`/inventory/${encodeURIComponent(String(id))}`);
    return mapInventoryRow(row);
  },

  /**
   * Fetches one enriched inventory record by product ID (Pxxx).
   * @param {string} productId
   * @returns {Promise<Object>}
   */
  async getByProductId(productId) {
    const row = await api(`/inventory/product/${encodeURIComponent(String(productId))}`);
    return mapInventoryRow(row);
  },

  /**
   * Lists enriched inventory rows currently at or below reorder threshold.
   * @param {{ companyId?: string }} [query]
   * @returns {Promise<Array<Object>>}
   */
  async getLowStock(query) {
    const data = await api('/inventory/low-stock', { query });
    return Array.isArray(data) ? data.map(mapInventoryRow) : [];
  },

  /**
   * Lists stock movement ledger entries.
   * @param {{ companyId?: string, productId?: string, type?: string, limit?: number }} [query]
   * @returns {Promise<Array<Object>>}
   */
  async getMovements(query) {
    const data = await api('/inventory/movements', { query });
    return Array.isArray(data) ? data : [];
  },

  /**
   * Applies a manual signed stock adjustment with reason. Returns DB-confirmed row.
   * @param {{ productId: string, adjustment: number, reason: string }} body
   * @returns {Promise<Object>}
   */
  async adjustStock(body) {
    const row = await api('/inventory/adjust', { method: 'POST', body });
    return mapInventoryRow(row);
  },

  /**
   * Records goods received from a supplier. Returns DB-confirmed row.
   * @param {{ productId: string, quantity: number, supplierId?: string, note?: string }} body
   * @returns {Promise<Object>}
   */
  async receiveStock({ productId, quantity, supplierId, note }) {
    const trimmedNote = note ? String(note).trim() : '';
    const row = await api('/inventory/receive', {
      method: 'POST',
      body: {
        productId,
        quantity,
        supplierId: supplierId || undefined,
        note: trimmedNote || undefined,
      },
    });
    return mapInventoryRow(row);
  },

  /**
   * Updates shelf metadata (`reorderLevel`, `location`). Never sets stock directly.
   * @param {string} id
   * @param {{ reorderLevel?: number, location?: string, version?: number }} body
   * @returns {Promise<Object>}
   */
  async update(id, body) {
    const row = await api(`/inventory/${encodeURIComponent(String(id))}`, { method: 'PUT', body });
    return mapInventoryRow(row);
  },

  /**
   * Hard-deletes an inventory record for an already-deactivated product.
   * @param {string} id
   * @returns {Promise<{ message: string, inventory: Object }>}
   */
  remove(id) {
    return api(`/inventory/${encodeURIComponent(String(id))}`, { method: 'DELETE' });
  },
};
