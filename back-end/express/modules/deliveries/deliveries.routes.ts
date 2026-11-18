import { Router } from 'express';
import { requireRoles } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import { deliveriesController, DeliveriesController } from './deliveries.controller';
import {
  createDeliverySchema,
  deliveryIdParamsSchema,
  listDeliveriesQuerySchema,
  orderIdParamsSchema,
  transitionDeliverySchema,
  updateDeliverySchema,
} from './deliveries.schema';

const DESK = ['superuser', 'admin', 'deliveryops'];
const READERS = [...DESK, 'cashier'];

/**
 * Deliveries Module Router
 *
 * '/order/:orderId' is registered before '/:id'.
 */
export function createDeliveriesRouter(controller: DeliveriesController = deliveriesController): Router {
  const router = Router();
  router.get('/', requireRoles(...READERS), validate({ query: listDeliveriesQuerySchema }), controller.findAll);
  router.get('/order/:orderId', requireRoles(...READERS), validate({ params: orderIdParamsSchema }), controller.findByOrder);
  router.get('/:id', requireRoles(...READERS), validate({ params: deliveryIdParamsSchema }), controller.findOne);
  router.post('/', requireRoles(...DESK, 'cashier'), validate({ body: createDeliverySchema }), controller.create);
  router.post(
    '/:id/status',
    requireRoles(...DESK),
    validate({ params: deliveryIdParamsSchema, body: transitionDeliverySchema }),
    controller.transition,
  );
  router.put(
    '/:id',
    requireRoles(...DESK),
    validate({ params: deliveryIdParamsSchema, body: updateDeliverySchema }),
    controller.update,
  );
  router.delete('/:id', requireRoles('superuser', 'admin'), validate({ params: deliveryIdParamsSchema }), controller.remove);
  return router;
}

export const deliveriesRouter = createDeliveriesRouter();
