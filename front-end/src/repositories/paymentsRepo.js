import { api } from '../lib/http.js';

/**
 * 1:1 frontend repository for backend `payments` module (`/api/payments`).
 */
export const paymentsRepo = {
  createRazorpayOrder: (body) =>
    api('/payments/razorpay/create-order', { method: 'POST', body }),

  verifyRazorpayPayment: (body) =>
    api('/payments/razorpay/verify', { method: 'POST', body }),

  createSubscriptionOrder: (body) =>
    api('/payments/razorpay/subscription/create-order', { method: 'POST', body }),

  verifySubscriptionPayment: (body) =>
    api('/payments/razorpay/subscription/verify', { method: 'POST', body }),
};
