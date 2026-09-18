// Pure helpers ported from scripts/ui.js (copy, checkout modes, totals, visuals).

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

  const key = String(explicitVisual || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (key && PRODUCT_VISUAL_FALLBACK[key]) return PRODUCT_VISUAL_FALLBACK[key];

  const productName = String((product && product.name) || '').trim().toLowerCase();
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
  const titlePrefix = isCustomer ? 'Self-checkout' : 'Order';

  if (safeMode === 'prepaid_delivery') {
    return {
      mode: 'prepaid_delivery',
      deliveryOption: 'delivery',
      paymentMethod: 'Paid Upfront',
      orderStatus: 'Processing',
      buttonLabel: 'Proceed to Payment Gateway',
      successTitle: 'Payment Gateway Ready',
      successSubtitle: `${titlePrefix} logged for home delivery. Collect payment now and dispatch once confirmed.`,
      summaryLabel: 'Prepaid delivery',
    };
  }

  if (safeMode === 'cod_delivery') {
    return {
      mode: 'cod_delivery',
      deliveryOption: 'delivery',
      paymentMethod: 'COD',
      orderStatus: 'Processing',
      buttonLabel: isCustomer ? 'Place COD Order' : 'Confirm COD Dispatch',
      successTitle: 'COD Delivery Booked',
      successSubtitle: `${titlePrefix} will be sent for delivery and payment will be collected at the doorstep.`,
      summaryLabel: 'Cash on delivery',
    };
  }

  return {
    mode: 'takeaway_now',
    deliveryOption: 'pickup',
    paymentMethod: 'Counter Paid',
    orderStatus: 'Delivered',
    buttonLabel: 'Proceed to Payment Gateway',
    successTitle: 'Takeaway Ready',
    successSubtitle: `${titlePrefix} is marked for immediate handover from the counter.`,
    summaryLabel: 'Take away now',
  };
}

export function getCartSubtotal(cart) {
  return cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
}

// ui.js updateCartTotal(): re-derives an active discount every time totals refresh.
export function recomputeDiscount(discount, subtotal) {
  if (!discount.active) return discount;
  const computedDiscount = discount.code === 'WELCOME10'
    ? Number((subtotal * 0.10).toFixed(2))
    : Math.max(0, Number(discount.discount || 0));
  return { ...discount, discount: Math.min(subtotal, computedDiscount) };
}

export function getCartTotals(cart, discount, deliveryChargeAmount) {
  const subtotal = getCartSubtotal(cart);
  const discountValue = Math.max(0, Number(discount.discount || 0));
  const itemTotal = Math.max(0, subtotal - discountValue);
  const deliveryCharge = deliveryChargeAmount;
  const payableTotal = itemTotal + deliveryCharge;
  return { subtotal, discount: discountValue, itemTotal, deliveryCharge, payableTotal };
}

export function getDeliveryChargeAmount(mode, checkoutSettings) {
  const isDelivery = getCheckoutModeConfig(mode).deliveryOption === 'delivery';
  if (!isDelivery) return 0;
  const configured = Number(checkoutSettings && checkoutSettings.deliveryCharge);
  return Number.isFinite(configured) && configured > 0 ? configured : 0;
}

export function formatRupees(value) {
  return `${RUPEE}${value.toFixed(2)}`;
}

export function clearStoredSession() {
  localStorage.removeItem('userRole');
  localStorage.removeItem('userName');
  localStorage.removeItem('currentUser');
  localStorage.removeItem('activeBusinessId');
  localStorage.removeItem('activeBusinessName');
  sessionStorage.removeItem('bb_customer_session_id');
  sessionStorage.removeItem('bb_customer_session_notifications');
}

export function getPlanBadge() {
  const savedPlan = localStorage.getItem('activeBusinessPlan') || 'pro';
  let bClass = 'b-active';
  if (savedPlan === 'starter') bClass = 'b-pending';
  if (savedPlan === 'enterprise') bClass = 'b-processing';
  const planName = savedPlan === 'starter' ? 'Starter' : (savedPlan === 'enterprise' ? 'Enterprise' : 'Growth / Pro');
  return { className: `badge ${bClass}`, planName };
}
