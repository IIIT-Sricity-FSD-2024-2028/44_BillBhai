import { Router } from 'express';
import { requireRoles } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import { inventoryController, InventoryController } from './inventory.controller';
import {
  adjustStockSchema,
  inventoryIdParamsSchema,
  productIdParamsSchema,
  updateInventorySchema,
} from './inventory.schema';

/**
 * Inventory Module Router
 *
 * Router-level middleware chain per endpoint:
 *   requireRoles(...)  -> role based access control
 *   validate({...})    -> zod schema validation
 *   controller.method  -> request handling
 *
 * ORDERING MATTERS: every literal path - /low-stock, /product/:productId,
 * /adjust - is registered BEFORE the generic /:id routes, otherwise the
 * parameterised handler swallows them.
 */
export function createInventoryRouter(
  controller: InventoryController = inventoryController,
): Router {
  const router = Router();

  router.get(
    '/low-stock',
    requireRoles('superuser', 'admin', 'inventorymanager'),
    controller.findLowStock,
  );

  router.get(
    '/product/:productId',
    requireRoles('superuser', 'admin', 'inventorymanager', 'cashier'),
    validate({ params: productIdParamsSchema }),
    controller.findByProduct,
  );

  router.post(
    '/adjust',
    requireRoles('superuser', 'admin', 'inventorymanager'),
    validate({ body: adjustStockSchema }),
    controller.adjustStock,
  );

  router.get(
    '/',
    requireRoles('superuser', 'admin', 'inventorymanager', 'cashier'),
    controller.findAll,
  );

  router.get(
    '/:id',
    requireRoles('superuser', 'admin', 'inventorymanager'),
    validate({ params: inventoryIdParamsSchema }),
    controller.findOne,
  );

  router.put(
    '/:id',
    requireRoles('superuser', 'admin', 'inventorymanager'),
    validate({ params: inventoryIdParamsSchema, body: updateInventorySchema }),
    controller.update,
  );

  router.delete(
    '/:id',
    requireRoles('superuser', 'admin', 'inventorymanager'),
    validate({ params: inventoryIdParamsSchema }),
    controller.remove,
  );

  return router;
}

export const inventoryRouter = createInventoryRouter();
