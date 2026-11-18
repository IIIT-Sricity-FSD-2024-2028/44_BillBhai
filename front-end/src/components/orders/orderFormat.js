/** Formatting shared by the Orders, Coupons, Dashboard and Reports screens. */

export function rupees(value, { decimals = 2 } = {}) {
  const n = Number(value) || 0;
  const whole = Number.isInteger(Number(n.toFixed(decimals)));
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: whole ? 0 : decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function todayKey() {
  return dayKey(new Date());
}

/** Date-range presets used by Orders, Reports and Coupons. */
export function rangePreset(key) {
  const now = new Date();
  const today = dayKey(now);
  switch (key) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const y = dayKey(addDays(now, -1));
      return { from: y, to: y };
    }
    case '7d':
      return { from: dayKey(addDays(now, -6)), to: today };
    case '30d':
      return { from: dayKey(addDays(now, -29)), to: today };
    case 'month':
      return { from: dayKey(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    case 'lastMonth': {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: dayKey(start), to: dayKey(end) };
    }
    default:
      return { from: '', to: '' };
  }
}

export const RANGE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
];

export function formatDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export function shortDay(key) {
  const d = new Date(`${key}T00:00:00`);
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/** Badge colour for each server status (the badge text stays the real status). */
const STATUS_COLOURS = {
  Processing: 'processing',
  Shipped: 'dispatched',
  Delivered: 'delivered',
  'Partially Returned': 'approved',
  Returned: 'refunded',
  Cancelled: 'cancelled',
  Paid: 'active',
  Pending: 'pending',
  Refunded: 'refunded',
  'Partially Refunded': 'approved',
  Voided: 'cancelled',
  Cash: 'cash',
  UPI: 'upi',
  Card: 'card',
  COD: 'cod',
};

export function statusColour(status) {
  return STATUS_COLOURS[status] || String(status || 'pending').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export const CHECKOUT_MODE_LABELS = {
  takeaway_now: 'Counter (take away)',
  prepaid_delivery: 'Delivery, paid',
  cod_delivery: 'Delivery, cash on delivery',
};

/** Business to send with requests: needed when a super user works inside a store. */
export function scopedCompanyId(state) {
  const id = String((state && state.activeBusinessId) || '').trim();
  return id && id !== 'PLATFORM' ? id : undefined;
}
