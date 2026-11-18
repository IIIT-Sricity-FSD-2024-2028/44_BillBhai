import { Router } from 'express';
import { requireRoles } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import { returnsController, ReturnsController } from './returns.controller';
import {
  createReturnSchema,
  listReturnsQuerySchema,
  orderIdParamsSchema,
  returnIdParamsSchema,
  transitionReturnSchema,
  updateReturnSchema,
} from './returns.schema';

const DESK = ['superuser', 'admin', 'returnhandler'];
/** Counter staff can look up an order and raise a return for the desk. */
const RAISERS = [...DESK, 'cashier'];

/** Returns Module Router */
export function createReturnsRouter(controller: ReturnsController = returnsController): Router {
  const router = Router();
  router.get('/', requireRoles(...RAISERS), validate({ query: listReturnsQuerySchema }), controller.findAll);
  router.get(
    '/order/:orderId/returnable',
    requireRoles(...RAISERS),
    validate({ params: orderIdParamsSchema }),
    controller.returnable,
  );
  router.get('/:id', requireRoles(...RAISERS), validate({ params: returnIdParamsSchema }), controller.findOne);
  router.post('/', requireRoles(...RAISERS), validate({ body: createReturnSchema }), controller.create);
  router.post(
    '/:id/status',
    requireRoles(...DESK),
    validate({ params: returnIdParamsSchema, body: transitionReturnSchema }),
    controller.transition,
  );
  router.put(
    '/:id',
    requireRoles(...DESK),
    validate({ params: returnIdParamsSchema, body: updateReturnSchema }),
    controller.update,
  );
  router.delete('/:id', requireRoles(...DESK), validate({ params: returnIdParamsSchema }), controller.remove);
  return router;
}

export const returnsRouter = createReturnsRouter();
