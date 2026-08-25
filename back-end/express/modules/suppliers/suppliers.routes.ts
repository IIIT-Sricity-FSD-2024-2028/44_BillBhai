import { Router } from 'express';
import { requireRoles } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import { suppliersController, SuppliersController } from './suppliers.controller';
import {
  createSupplierSchema,
  supplierIdParamsSchema,
  updateSupplierSchema,
} from './suppliers.schema';

/**
 * Suppliers Module Router
 *
 * Router-level middleware chain per endpoint:
 *   requireRoles(...)  -> role based access control
 *   validate({...})    -> zod schema validation
 *   controller.method  -> request handling
 */
export function createSuppliersRouter(
  controller: SuppliersController = suppliersController,
): Router {
  const router = Router();

  router.get(
    '/',
    requireRoles('superuser', 'admin', 'inventorymanager'),
    controller.findAll,
  );

  router.get(
    '/:id',
    requireRoles('superuser', 'admin', 'inventorymanager'),
    validate({ params: supplierIdParamsSchema }),
    controller.findOne,
  );

  router.post(
    '/',
    requireRoles('superuser', 'admin', 'inventorymanager'),
    validate({ body: createSupplierSchema }),
    controller.create,
  );

  router.put(
    '/:id',
    requireRoles('superuser', 'admin', 'inventorymanager'),
    validate({ params: supplierIdParamsSchema, body: updateSupplierSchema }),
    controller.update,
  );

  router.delete(
    '/:id',
    requireRoles('superuser', 'admin'),
    validate({ params: supplierIdParamsSchema }),
    controller.remove,
  );

  return router;
}

export const suppliersRouter = createSuppliersRouter();
