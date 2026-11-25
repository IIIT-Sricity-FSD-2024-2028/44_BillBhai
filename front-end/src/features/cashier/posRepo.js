import { api } from '../../shared/lib/http.js';

/**
 * Repository bridge for POS endpoints used by `posCartSlice`
 * until dedicated `inventory` and `orders` slices are integrated.
 */
export const posRepo = {
  fetchCatalog: async () => {
    const rows = await api('/inventory');
    return (Array.isArray(rows) ? rows : [])
      .filter((row) => row.active !== false)
      .map((row) => ({
        id: row.productId,
        name: row.productName,
        category: row.category || 'Other',
        price: Number(row.price) || 0,
        barcode: row.barcode || '',
        size: row.size || '',
        gstRate: Number(row.gstRate) || 0,
        stock: Math.max(0, Number(row.stockAvailable) || 0),
        status: row.status || '',
        options: [{ label: row.size || 'Unit', price: Number(row.price) || 0 }],
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  validatePromotion: async ({ code, subtotal, phone }) => {
    const upper = String(code || '').trim().toUpperCase();
    if (!upper) return { active: false, discount: 0, error: 'Enter a coupon code.' };
    const digits = String(phone || '').replace(/\D/g, '');
    const result = await api('/orders/promotions/validate', {
      method: 'POST',
      body: {
        code: upper,
        subtotal: Math.max(0, Number(subtotal) || 0),
        customerPhone: digits || undefined,
      },
    });
    return {
      active: true,
      code: result.code,
      discount: Number(result.discount) || 0,
      description: result.description || '',
    };
  },

  quoteOrder: (payload) => api('/orders/quote', { method: 'POST', body: payload }),

  placeOrder: (payload) => api('/orders', { method: 'POST', body: payload }),

  fetchMySalesToday: async (userId) => {
    const rows = await api('/orders');
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return (Array.isArray(rows) ? rows : [])
      .filter((o) => new Date(o.orderDate) >= start)
      .filter((o) => !userId || o.staffId === userId)
      .sort((a, b) => String(b.orderDate).localeCompare(String(a.orderDate)));
  },
};
