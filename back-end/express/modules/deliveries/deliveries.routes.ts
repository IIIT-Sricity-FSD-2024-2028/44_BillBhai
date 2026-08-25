import { Router } from 'express';
import { requireRoles } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  deliveriesController,
  DeliveriesController,
} from './deliveries.controller';
import {
  createDeliverySchema,
  deliveryIdParamsSchema,
  listDeliveriesQuerySchema,
  orderIdParamsSchema,
  updateDeliverySchema,
} from './deliveries.schema';

/**
 * Deliveries Module Router
 *
 * Router-level middleware chain per endpoint:
 *   requireRoles(...)  -> role based access control
 *   validate({...})    -> zod schema validation
 *   controller.method  -> request handling
 *
 * ORDERING MATTERS: the literal path /order/:orderId is registered BEFORE the
 * generic /:id routes, otherwise the parameterised handler swallows it.
 */
export function createDeliveriesRouter(
  controller: DeliveriesController = deliveriesController,
): Router {
  const router = Router();

  router.get(
    '/order/:orderId',
    requireRoles('superuser', 'admin', 'deliveryops', 'cashier'),
    validate({ params: orderIdParamsSchema }),
    controller.findByOrder,
  );

  router.get(
    '/',
    requireRoles('superuser', 'admin', 'deliveryops'),
    validate({ query: listDeliveriesQuerySchema }),
    controller.findAll,
  );

  router.post(
    '/',
    requireRoles('superuser', 'admin', 'deliveryops', 'cashier'),
    validate({ body: createDeliverySchema }),
    controller.create,
  );

  router.get(
    '/:id',
    requireRoles('superuser', 'admin', 'deliveryops'),
    validate({ params: deliveryIdParamsSchema }),
    controller.findOne,
  );

  router.put(
    '/:id',
    requireRoles('superuser', 'admin', 'deliveryops'),
    validate({ params: deliveryIdParamsSchema, body: updateDeliverySchema }),
    controller.update,
  );

  router.delete(
    '/:id',
    requireRoles('superuser', 'admin'),
    validate({ params: deliveryIdParamsSchema }),
    controller.remove,
  );

  return router;
}

export const deliveriesRouter = createDeliveriesRouter();
