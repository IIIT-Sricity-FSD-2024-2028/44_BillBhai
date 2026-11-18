export const RUPEE = '₹';

export const PRODUCT_VISUAL_FALLBACK = {
  rice: '🍚',
  dal: '🫘',
  oil: '🛢️',
  butter: '🧈',
  milk: '🥛',
  bread: '🍞',
  noodles: '🍜',
  tea: '🍵',
  coffee: '☕',
  atta: '🌾',
  sugar: '🧂',
  paneer: '🧀',
  curd: '🥣',
  chips: '🍟',
  biscuits: '🍪',
  juice: '🧃',
  water: '💧',
  soap: '🧼',
  dishwash: '🧴',
  detergent: '🫧',
};

export function resolveProductVisual(product) {
  const explicitVisual = String((product && product.image) || '').trim();
  // eslint-disable-next-line no-control-regex
  if (explicitVisual && /[^\x00-\x7F]/.test(explicitVisual)) return explicitVisual;

  const key = String(explicitVisual || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  if (key && PRODUCT_VISUAL_FALLBACK[key]) return PRODUCT_VISUAL_FALLBACK[key];

  const productName = String((product && product.name) || '')
    .trim()
    .toLowerCase();
  const byName = Object.keys(PRODUCT_VISUAL_FALLBACK).find((token) => productName.includes(token));
  return byName ? PRODUCT_VISUAL_FALLBACK[byName] : '🛍️';
}

export function sanitizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

export function getTerminalCopy(isCustomerTerminal) {
  if (isCustomerTerminal) {
    return {
      lookupInfo: 'Enter your 10-digit phone number to auto-fill saved details.',
      lookupExisting: (name) => `Welcome back, ${name}. Your saved checkout details are ready.`,
      lookupNew: 'No saved profile found yet. We will create one after checkout.',
    };
  }

  return {
    lookupInfo: 'Enter a 10-digit phone number to check existing customer records.',
    lookupExisting: (name) => `Existing customer found: ${name}. Details auto-filled.`,
    lookupNew: 'No existing profile found. Creating a new customer record after checkout.',
  };
}

export function getCheckoutModeConfig(mode, isCustomerTerminal) {
  const safeMode = String(mode || 'takeaway_now').trim().toLowerCase();
  const isCustomer = Boolean(isCustomerTerminal);
  const titlePrefix = isCustomer ? 'Your order' : 'Order';

  if (safeMode === 'prepaid_delivery') {
    return {
      mode: 'prepaid_delivery',
      deliveryOption: 'delivery',
      paymentMethods: isCustomer ? ['UPI', 'Card'] : ['UPI', 'Card', 'Cash'],
      buttonLabel: 'Take payment & book delivery',
      successTitle: 'Paid. Delivery booked',
      successSubtitle: `${titlePrefix} is paid and is now in the delivery queue.`,
      summaryLabel: 'Prepaid delivery',
    };
  }

  if (safeMode === 'cod_delivery') {
    return {
      mode: 'cod_delivery',
      deliveryOption: 'delivery',
      paymentMethods: ['COD'],
      buttonLabel: isCustomer ? 'Place COD order' : 'Book COD delivery',
      successTitle: 'COD delivery booked',
      successSubtitle: `${titlePrefix} is in the delivery queue. The partner collects the cash at the door.`,
      summaryLabel: 'Cash on delivery',
    };
  }

  return {
    mode: 'takeaway_now',
    deliveryOption: 'pickup',
    paymentMethods: isCustomer ? ['UPI', 'Card'] : ['Cash', 'UPI', 'Card'],
    buttonLabel: 'Take payment & finish',
    successTitle: 'Paid. Hand over the items',
    successSubtitle: `${titlePrefix} is paid and the stock has been updated.`,
    summaryLabel: 'Take away now',
  };
}

export function getCartSubtotal(cart) {
  return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

/** Coupon discounts come from the server; this only keeps them within the bill. */
export function recomputeDiscount(discount, subtotal) {
  if (!discount.active) return discount;
  return { ...discount, discount: Math.min(subtotal, Math.max(0, Number(discount.discount || 0))) };
}

export function getCartTotals(cart, discount, deliveryChargeAmount) {
  const subtotal = getCartSubtotal(cart);
  const discountValue = Math.max(0, Number(discount.discount || 0));
  const itemTotal = Math.max(0, subtotal - discountValue);
  const deliveryCharge = deliveryChargeAmount;
  const payableTotal = itemTotal + deliveryCharge;
  return { subtotal, discount: discountValue, itemTotal, deliveryCharge, payableTotal };
}

export function formatRupees(value) {
  return `${RUPEE}${(Number(value) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export { clearStoredSession } from '../http.js';

export function getPlanBadge() {
  const savedPlan = localStorage.getItem('activeBusinessPlan') || 'pro';
  let bClass = 'b-active';
  if (savedPlan === 'starter') bClass = 'b-pending';
  if (savedPlan === 'enterprise') bClass = 'b-processing';
  const planName =
    savedPlan === 'starter'
      ? 'Starter'
      : savedPlan === 'enterprise'
        ? 'Enterprise'
        : 'Growth / Pro';
  return { className: `badge ${bClass}`, planName };
}
