import { Router } from 'express';
import { requireRoles } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import { ordersController, OrdersController } from './orders.controller';
import {
  billNoParamsSchema,
  createBillSchema,
  createOrderSchema,
  createPaymentSchema,
  listOrdersQuerySchema,
  orderIdParamsSchema,
  updateOrderSchema,
  validatePromotionSchema,
} from './orders.schema';

/**
 * Orders Module Router
 *
 * Router-level middleware chain per endpoint:
 *   requireRoles(...)  -> role based access control
 *   validate({...})    -> zod schema validation
 *   controller.method  -> request handling
 *
 * ORDERING MATTERS: every literal path - /promotions/validate, /bills/all,
 * /payments/all - is registered BEFORE the generic /:id routes, otherwise the
 * parameterised handler swallows them.
 */
export function createOrdersRouter(
  controller: OrdersController = ordersController,
): Router {
  const router = Router();

  router.post(
    '/promotions/validate',
    requireRoles('superuser', 'admin', 'cashier', 'customer'),
    validate({ body: validatePromotionSchema }),
    controller.validatePromotion,
  );

  router.get(
    '/bills/all',
    requireRoles('superuser', 'admin', 'cashier'),
    controller.findAllBills,
  );

  router.post(
    '/bills',
    requireRoles('superuser', 'admin', 'cashier'),
    validate({ body: createBillSchema }),
    controller.createBill,
  );

  router.get(
    '/bills/:billNo',
    requireRoles('superuser', 'admin', 'cashier'),
    validate({ params: billNoParamsSchema }),
    controller.findOneBill,
  );

  router.get(
    '/payments/all',
    requireRoles('superuser', 'admin', 'cashier'),
    controller.findAllPayments,
  );

  router.post(
    '/payments',
    requireRoles('superuser', 'admin', 'cashier'),
    validate({ body: createPaymentSchema }),
    controller.createPayment,
  );

  router.get(
    '/payments/:billNo',
    requireRoles('superuser', 'admin', 'cashier'),
    validate({ params: billNoParamsSchema }),
    controller.findOnePayment,
  );

  router.get(
    '/',
    requireRoles('superuser', 'admin', 'cashier', 'returnhandler'),
    validate({ query: listOrdersQuerySchema }),
    controller.findAll,
  );

  router.post(
    '/',
    requireRoles('superuser', 'admin', 'cashier', 'customer'),
    validate({ body: createOrderSchema }),
    controller.create,
  );

  router.get(
    '/:id',
    requireRoles('superuser', 'admin', 'cashier', 'returnhandler', 'deliveryops'),
    validate({ params: orderIdParamsSchema }),
    controller.findOne,
  );

  router.put(
    '/:id',
    requireRoles('superuser', 'admin', 'cashier'),
    validate({ params: orderIdParamsSchema, body: updateOrderSchema }),
    controller.update,
  );

  router.delete(
    '/:id',
    requireRoles('superuser', 'admin'),
    validate({ params: orderIdParamsSchema }),
    controller.remove,
  );

  return router;
}

export const ordersRouter = createOrdersRouter();
