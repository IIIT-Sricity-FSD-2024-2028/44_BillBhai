import { dayKey } from './orderFormat.js';

/**
 * Filters for the Orders page. Pure functions: the page keeps the filter
 * values in state and derives the visible rows during render.
 */

export const ORDER_STATUS_OPTIONS = ['Processing', 'Shipped', 'Delivered', 'Partially Returned', 'Returned', 'Cancelled'];
export const PAYMENT_METHOD_OPTIONS = ['Cash', 'UPI', 'Card', 'COD'];
export const PAYMENT_STATUS_OPTIONS = ['Paid', 'Pending', 'Refunded', 'Partially Refunded', 'Voided'];
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const HOUR_BANDS = [
  { value: 'morning', label: 'Morning (6 am – 12 pm)', test: (h) => h >= 6 && h < 12 },
  { value: 'afternoon', label: 'Afternoon (12 – 5 pm)', test: (h) => h >= 12 && h < 17 },
  { value: 'evening', label: 'Evening (5 – 11 pm)', test: (h) => h >= 17 && h < 23 },
  { value: 'night', label: 'Late night (11 pm – 6 am)', test: (h) => h >= 23 || h < 6 },
];

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'total_high', label: 'Total high-low' },
  { value: 'total_low', label: 'Total low-high' },
  { value: 'discount_high', label: 'Biggest discount' },
  { value: 'items_high', label: 'Most items' },
];

export const DEFAULT_FILTERS = {
  status: 'all',
  payment: 'all',
  search: '',
  sort: 'newest',
  from: '',
  to: '',
  coupon: 'all',
  type: 'all',
  mode: 'all',
  cashier: 'all',
  minAmount: '',
  maxAmount: '',
  minItems: '',
  product: 'all',
  category: 'all',
  paymentStatus: 'all',
  returnedOnly: false,
  minDiscountPct: '',
  weekday: 'all',
  hourBand: 'all',
  customerKind: 'all',
};

/** Advanced filters currently narrowing the list (for the "N active" label). */
export function activeAdvancedCount(f) {
  const keys = [
    'from', 'to', 'coupon', 'type', 'mode', 'cashier', 'minAmount', 'maxAmount', 'minItems',
    'product', 'category', 'paymentStatus', 'returnedOnly', 'minDiscountPct', 'weekday', 'hourBand', 'customerKind',
  ];
  return keys.filter((k) => f[k] !== DEFAULT_FILTERS[k]).length;
}

/** Id of each repeat-tracked customer's first order (walk-ins have no phone, so they are left out). */
export function firstOrderByCustomer(orders) {
  const first = new Map();
  [...orders]
    .filter((o) => o.customerPhone && o.status !== 'Cancelled')
    .sort((a, b) => String(a.orderDate).localeCompare(String(b.orderDate)))
    .forEach((o) => {
      if (!first.has(o.customerId)) first.set(o.customerId, o.id);
    });
  return first;
}

function num(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function filterOrders(orders, f, { categoryOf, firstOrders }) {
  const search = String(f.search || '').trim().toLowerCase();
  const minAmount = num(f.minAmount);
  const maxAmount = num(f.maxAmount);
  const minItems = num(f.minItems);
  const minDiscountPct = num(f.minDiscountPct);
  const band = HOUR_BANDS.find((b) => b.value === f.hourBand);

  return orders.filter((o) => {
    if (f.status !== 'all' && o.status !== f.status) return false;
    if (f.payment !== 'all' && o.payment !== f.payment) return false;
    if (search) {
      const hay = `${o.id} ${o.customer} ${o.customerPhone} ${o.billNo} ${o.promoCode}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    const when = new Date(o.orderDate);
    const day = dayKey(when);
    if (f.from && day < f.from) return false;
    if (f.to && day > f.to) return false;
    if (f.coupon === 'any' && !o.promoCode) return false;
    if (f.coupon === 'none' && o.promoCode) return false;
    if (!['all', 'any', 'none'].includes(f.coupon) && o.promoCode !== f.coupon) return false;
    if (f.type !== 'all' && o.orderType !== f.type) return false;
    if (f.mode !== 'all' && o.checkoutMode !== f.mode) return false;
    if (f.cashier !== 'all' && o.staffName !== f.cashier) return false;
    if (minAmount !== null && o.total < minAmount) return false;
    if (maxAmount !== null && o.total > maxAmount) return false;
    if (minItems !== null && o.items < minItems) return false;
    if (f.product !== 'all' && !o.lines.some((l) => l.productId === f.product)) return false;
    if (f.category !== 'all' && !o.lines.some((l) => categoryOf(l.productId) === f.category)) return false;
    if (f.paymentStatus !== 'all' && o.paymentStatus !== f.paymentStatus) return false;
    if (f.returnedOnly && !(o.refunded > 0 || o.status === 'Partially Returned' || o.status === 'Returned')) return false;
    if (minDiscountPct !== null) {
      const pct = o.subtotal > 0 ? (o.discount / o.subtotal) * 100 : 0;
      if (pct < minDiscountPct) return false;
    }
    if (f.weekday !== 'all' && WEEKDAYS[when.getDay()] !== f.weekday) return false;
    if (band && !band.test(when.getHours())) return false;
    if (f.customerKind !== 'all') {
      if (!o.customerPhone) return false;
      const isFirst = firstOrders.get(o.customerId) === o.id;
      if (f.customerKind === 'first' && !isFirst) return false;
      if (f.customerKind === 'repeat' && isFirst) return false;
    }
    return true;
  });
}

export function sortOrders(rows, sortKey) {
  const time = (o) => new Date(o.orderDate).getTime() || 0;
  const list = [...rows];
  list.sort((a, b) => {
    if (sortKey === 'oldest') return time(a) - time(b);
    if (sortKey === 'total_high') return b.total - a.total;
    if (sortKey === 'total_low') return a.total - b.total;
    if (sortKey === 'discount_high') return b.discount - a.discount;
    if (sortKey === 'items_high') return b.items - a.items;
    return time(b) - time(a);
  });
  return list;
}

export function summarise(rows) {
  return rows.reduce(
    (acc, o) => {
      if (o.status === 'Cancelled') {
        acc.cancelled += 1;
        return acc;
      }
      acc.billed += o.total;
      acc.net += o.net;
      acc.discount += o.discount;
      acc.refunded += o.refunded;
      return acc;
    },
    { billed: 0, net: 0, discount: 0, refunded: 0, cancelled: 0 },
  );
}
