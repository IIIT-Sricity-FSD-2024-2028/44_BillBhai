import { Router } from 'express';
import { requireRoles } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import { customersController, CustomersController } from './customers.controller';
import {
  createCustomerSchema,
  customerIdParamsSchema,
  customerPhoneParamsSchema,
  listCustomersQuerySchema,
  updateCustomerSchema,
} from './customers.schema';

/**
 * Customers Module Router
 *
 * Router-level middleware chain per endpoint:
 *   requireRoles(...)  -> role based access control
 *   validate({...})    -> zod schema validation
 *   controller.method  -> request handling
 *
 * ORDER MATTERS: `/phone/:phone` is registered before `/:id`, otherwise the
 * parameterised route would swallow the phone lookup.
 */
export function createCustomersRouter(
  controller: CustomersController = customersController,
): Router {
  const router = Router();

  router.get(
    '/phone/:phone',
    requireRoles('superuser', 'admin', 'cashier', 'customer'),
    validate({
      params: customerPhoneParamsSchema,
      query: listCustomersQuerySchema,
    }),
    controller.findByPhone,
  );

  router.get(
    '/',
    requireRoles('superuser', 'admin', 'cashier'),
    validate({ query: listCustomersQuerySchema }),
    controller.findAll,
  );

  router.get(
    '/:id',
    requireRoles('superuser', 'admin', 'cashier'),
    validate({ params: customerIdParamsSchema }),
    controller.findOne,
  );

  router.post(
    '/',
    requireRoles('superuser', 'admin', 'cashier', 'customer'),
    validate({ body: createCustomerSchema }),
    controller.create,
  );

  router.put(
    '/:id',
    requireRoles('superuser', 'admin', 'cashier', 'customer'),
    validate({ params: customerIdParamsSchema, body: updateCustomerSchema }),
    controller.update,
  );

  router.delete(
    '/:id',
    requireRoles('superuser', 'admin'),
    validate({ params: customerIdParamsSchema }),
    controller.remove,
  );

  return router;
}

export const customersRouter = createCustomersRouter();
