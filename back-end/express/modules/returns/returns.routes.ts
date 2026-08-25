import { Router } from 'express';
import { requireRoles } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import { returnsController, ReturnsController } from './returns.controller';
import {
  createReturnSchema,
  listReturnsQuerySchema,
  returnIdParamsSchema,
  updateReturnSchema,
} from './returns.schema';

/**
 * Returns Module Router
 *
 * Router-level middleware chain per endpoint:
 *   requireRoles(...)  -> role based access control
 *   validate({...})    -> zod schema validation
 *   controller.method  -> request handling
 */
export function createReturnsRouter(
  controller: ReturnsController = returnsController,
): Router {
  const router = Router();

  router.get(
    '/',
    requireRoles('superuser', 'admin', 'returnhandler'),
    validate({ query: listReturnsQuerySchema }),
    controller.findAll,
  );

  router.post(
    '/',
    requireRoles('superuser', 'admin', 'returnhandler', 'cashier'),
    validate({ body: createReturnSchema }),
    controller.create,
  );

  router.get(
    '/:id',
    requireRoles('superuser', 'admin', 'returnhandler'),
    validate({ params: returnIdParamsSchema }),
    controller.findOne,
  );

  router.put(
    '/:id',
    requireRoles('superuser', 'admin', 'returnhandler'),
    validate({ params: returnIdParamsSchema, body: updateReturnSchema }),
    controller.update,
  );

  router.delete(
    '/:id',
    requireRoles('superuser', 'admin'),
    validate({ params: returnIdParamsSchema }),
    controller.remove,
  );

  return router;
}

export const returnsRouter = createReturnsRouter();
