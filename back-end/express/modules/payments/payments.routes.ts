import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.middleware';
import { requireRoles } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import { paymentsController } from './payments.controller';
import {
  createRazorpayOrderSchema,
  createSubscriptionOrderSchema,
  verifyRazorpayPaymentSchema,
  verifySubscriptionPaymentSchema,
} from './payments.schema';

/** Payments Module Routes */

export function createPaymentsRouter(): Router {
  const router = Router();

  /**
   * POST /api/payments/razorpay/create-order
   * Create a new Razorpay Order for POS checkout / bills
   */
  router.post(
    '/razorpay/create-order',
    requireRoles('admin', 'cashier', 'customer', 'superuser'),
    validate({ body: createRazorpayOrderSchema }),
    asyncHandler((req, res) => paymentsController.createRazorpayOrder(req, res)),
  );

  /**
   * POST /api/payments/razorpay/verify
   * Cryptographically verify Razorpay Payment HMAC SHA256 signature for POS bills
   */
  router.post(
    '/razorpay/verify',
    requireRoles('admin', 'cashier', 'customer', 'superuser'),
    validate({ body: verifyRazorpayPaymentSchema }),
    (req, res) => paymentsController.verifyRazorpayPayment(req, res),
  );

  /**
   * POST /api/payments/razorpay/subscription/create-order
   * Create a Razorpay Order for Business Subscription Plan (Growth / Pro / Enterprise)
   */
  router.post(
    '/razorpay/subscription/create-order',
    requireRoles('admin', 'superuser'),
    validate({ body: createSubscriptionOrderSchema }),
    asyncHandler((req, res) =>
      paymentsController.createSubscriptionOrder(req, res),
    ),
  );

  /**
   * POST /api/payments/razorpay/subscription/verify
   * Verify Razorpay Subscription Payment signature and update Tenant subscription
   */
  router.post(
    '/razorpay/subscription/verify',
    requireRoles('admin', 'superuser'),
    validate({ body: verifySubscriptionPaymentSchema }),
    (req, res) => paymentsController.verifySubscriptionPayment(req, res),
  );

  /**
   * POST /api/payments/razorpay/webhook
   * Razorpay Server Webhook Callback
   */
  router.post('/razorpay/webhook', (req, res) =>
    paymentsController.handleWebhook(req, res),
  );

  return router;
}

export const paymentsRouter = createPaymentsRouter();
