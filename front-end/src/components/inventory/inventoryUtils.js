/** Small helpers shared by the inventory screens. */

export const GST_RATES = [0, 5, 12, 18, 28];

export const CATEGORY_SUGGESTIONS = [
  'Groceries',
  'Dairy',
  'Bakery',
  'Snacks',
  'Beverages',
  'Home Care',
  'Personal Care',
  'Other',
];

export const ADJUST_REASONS = ['Damaged', 'Expired', 'Count correction', 'Theft/Loss', 'Other'];

export const MOVEMENT_LABELS = {
  opening: 'Opening stock',
  sale: 'Sale',
  return: 'Customer return',
  cancel: 'Order cancelled',
  receive: 'Goods received',
  adjust: 'Adjustment',
  exchange: 'Exchange',
};

import { formatCurrency } from '../../lib/currency.js';

export function money(value) {
  return formatCurrency(value);
}

export function dateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function isBelowReorder(item) {
  return Number(item.stock) <= Number(item.reorderLevel);
}

/** Enough to get back to twice the reorder level, never below the supplier's minimum order. */
export function suggestedOrderQty(item) {
  const target = Math.max(0, 2 * Number(item.reorderLevel || 0) - Number(item.stock || 0));
  return Math.max(Number(item.moq || 0), target, 1);
}

export const WHOLE = /^\d+$/;
export const MONEY = /^\d+(\.\d{1,2})?$/;
export const BARCODE = /^[0-9A-Za-z-]{3,20}$/;
export const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const EMAIL = /^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/;

/** 10-digit Indian mobile, digits only, or '' when it is not one. */
export function mobileDigits(value) {
  const digits = String(value || '').replace(/\D/g, '');
  const tail = digits.length > 10 && digits.startsWith('91') ? digits.slice(-10) : digits;
  return /^[6-9]\d{9}$/.test(tail) ? tail : '';
}

export function formatMobile(value) {
  const d = mobileDigits(value);
  return d ? `+91\u00a0${d.slice(0, 5)}\u00a0${d.slice(5)}` : String(value || '');
}

export const SMALL_BTN = { padding: '4px 8px', fontSize: '0.75rem', marginRight: '4px', marginBottom: '2px' };
export const DANGER_BTN = { ...SMALL_BTN, color: 'var(--red)', borderColor: 'var(--red)' };
