import { api } from '../http.js';
import { LIVE_SYNC_KEY } from '../dashboard/constants.js';

/**
 * Data access for the till. Everything comes from the server:
 * the catalogue with live stock, customer lookup, coupon checks, the priced
 * quote and the sale itself. Nothing about a sale is kept only in the browser.
 */

export function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

export function getSessionContext() {
  let currentUser = {};
  try {
    currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}') || {};
  } catch {
    currentUser = {};
  }
  const roleKey = String(localStorage.getItem('userRole') || 'cashier').toLowerCase().replace(/\s+/g, '');
  const isCustomerTerminal = roleKey === 'customer';
  const userName = String(currentUser.name || localStorage.getItem('userName') || '').trim();
  return {
    userId: String(currentUser.id || ''),
    businessId: String(localStorage.getItem('activeBusinessId') || currentUser.companyId || ''),
    businessName: String(localStorage.getItem('activeBusinessName') || '').trim(),
    userName: userName || (isCustomerTerminal ? 'Self Checkout' : 'Cashier'),
    roleKey,
    roleLabel: isCustomerTerminal ? 'Self Checkout' : roleKey === 'admin' ? 'Admin' : 'Cashier',
    isCustomerTerminal,
  };
}

/** Active products of this business with what is on the shelf right now. */
export async function loadCatalog() {
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
}

export async function loadBusinessProfile() {
  try {
    return await api('/companies/me/profile');
  } catch {
    return null;
  }
}

export function getCategories(catalog) {
  return ['All', ...Array.from(new Set(catalog.map((p) => p.category))).sort()];
}

export function searchCatalog(catalog, query, category) {
  let results = catalog;
  if (category && category !== 'All') results = results.filter((p) => p.category === category);
  const q = String(query || '').trim().toLowerCase();
  if (q) {
    results = results.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        String(p.barcode).toLowerCase() === q ||
        p.id.toLowerCase() === q,
    );
  }
  return results;
}

/** Exact barcode (or product id) match, for scanners that type and press Enter. */
export function findByCode(catalog, code) {
  const needle = String(code || '').trim().toLowerCase();
  if (!needle) return null;
  return catalog.find((p) => String(p.barcode).toLowerCase() === needle || p.id.toLowerCase() === needle) || null;
}

export async function lookupCustomer(phone) {
  const digits = normalizePhone(phone);
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  try {
    return await api(`/customers/phone/${digits}`);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

/** Asks the server whether a coupon applies to this bill and customer. */
export async function validateCoupon(code, subtotal, phone) {
  const upper = String(code || '').trim().toUpperCase();
  if (!upper) return { active: false, discount: 0, error: 'Enter a coupon code.' };
  try {
    const result = await api('/orders/promotions/validate', {
      method: 'POST',
      body: { code: upper, subtotal: Math.max(0, Number(subtotal) || 0), customerPhone: normalizePhone(phone) || undefined },
    });
    return { active: true, code: result.code, discount: Number(result.discount) || 0, description: result.description || '' };
  } catch (error) {
    return { active: false, discount: 0, error: error.message || 'Coupon could not be checked.' };
  }
}

export function buildOrderPayload({ cart, couponCode, checkoutMode, paymentMethod, customer, deliveryCharge, partner, amountTendered }) {
  const isDelivery = checkoutMode !== 'takeaway_now';
  const phone = normalizePhone(customer.phone);
  return {
    checkoutMode,
    paymentMethod: checkoutMode === 'cod_delivery' ? 'COD' : paymentMethod,
    promoCode: couponCode || undefined,
    deliveryCharge: isDelivery ? Math.max(0, Number(deliveryCharge) || 0) : undefined,
    amountTendered: paymentMethod === 'Cash' && amountTendered !== '' && amountTendered !== undefined ? Number(amountTendered) : undefined,
    notes: String(customer.notes || '').trim() || undefined,
    customer: {
      name: customer.walkIn && !phone ? undefined : String(customer.name || '').trim() || undefined,
      phone: phone || undefined,
      email: String(customer.email || '').trim() || undefined,
      address: isDelivery ? String(customer.address || '').trim() : undefined,
    },
    delivery: isDelivery
      ? {
          address: String(customer.address || '').trim(),
          partnerName: String(partner.name || '').trim() || undefined,
          partnerPhone: normalizePhone(partner.phone) || undefined,
        }
      : undefined,
    // The price on screen goes along so a stale till cannot undercharge.
    items: cart.map((item) => ({ productId: item.id, quantity: item.qty, itemPrice: item.price })),
  };
}

export function quoteOrder(payload) {
  return api('/orders/quote', { method: 'POST', body: payload });
}

export function placeOrder(payload) {
  return api('/orders', { method: 'POST', body: payload });
}

/** This cashier's bills since midnight. */
export async function loadMySalesToday(userId) {
  const rows = await api('/orders');
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return (Array.isArray(rows) ? rows : [])
    .filter((o) => new Date(o.orderDate) >= start)
    .filter((o) => !userId || o.staffId === userId)
    .sort((a, b) => String(b.orderDate).localeCompare(String(a.orderDate)));
}

/** Tells open dashboard tabs (Orders, Inventory, Delivery) to reload. */
export function announceSale(companyId) {
  try {
    localStorage.setItem(
      LIVE_SYNC_KEY,
      JSON.stringify({ sourceId: `pos-${Date.now()}`, at: Date.now(), businessId: companyId || '', domains: ['orders', 'inventory', 'deliveries'] }),
    );
  } catch {
    /* storage blocked: other tabs still refresh on their timer */
  }
}
