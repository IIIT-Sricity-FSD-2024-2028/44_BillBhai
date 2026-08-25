import { Router } from 'express';
import { requireRoles } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import { productsController, ProductsController } from './products.controller';
import {
  createProductSchema,
  listProductsQuerySchema,
  productBarcodeParamsSchema,
  productIdParamsSchema,
  updateProductSchema,
} from './products.schema';

/**
 * Products Module Router
 *
 * Router-level middleware chain per endpoint:
 *   requireRoles(...)  -> role based access control
 *   validate({...})    -> zod schema validation
 *   controller.method  -> request handling
 *
 * NOTE: the literal '/categories' and '/barcode/:barcode' paths are registered
 * before '/:id', otherwise the parameterised route would capture them.
 */
export function createProductsRouter(
  controller: ProductsController = productsController,
): Router {
  const router = Router();

  router.get(
    '/categories',
    requireRoles('superuser', 'admin', 'cashier', 'inventorymanager', 'customer'),
    controller.getCategories,
  );

  router.get(
    '/barcode/:barcode',
    requireRoles('superuser', 'admin', 'cashier', 'inventorymanager'),
    validate({ params: productBarcodeParamsSchema }),
    controller.findByBarcode,
  );

  router.get(
    '/',
    requireRoles('superuser', 'admin', 'cashier', 'inventorymanager', 'customer'),
    validate({ query: listProductsQuerySchema }),
    controller.findAll,
  );

  router.get(
    '/:id',
    requireRoles('superuser', 'admin', 'cashier', 'inventorymanager', 'customer'),
    validate({ params: productIdParamsSchema }),
    controller.findOne,
  );

  router.post(
    '/',
    requireRoles('superuser', 'admin', 'inventorymanager'),
    validate({ body: createProductSchema }),
    controller.create,
  );

  router.put(
    '/:id',
    requireRoles('superuser', 'admin', 'inventorymanager'),
    validate({ params: productIdParamsSchema, body: updateProductSchema }),
    controller.update,
  );

  router.delete(
    '/:id',
    requireRoles('superuser', 'admin', 'inventorymanager'),
    validate({ params: productIdParamsSchema }),
    controller.remove,
  );

  return router;
}

export const productsRouter = createProductsRouter();
