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

const READERS = ['superuser', 'admin', 'cashier', 'inventorymanager', 'returnhandler', 'customer'];
const WRITERS = ['superuser', 'admin', 'inventorymanager'];

/**
 * Products Module Router
 *
 * NOTE: the literal '/categories' and '/barcode/:barcode' paths are registered
 * before '/:id', otherwise the parameterised route would capture them.
 */
export function createProductsRouter(controller: ProductsController = productsController): Router {
  const router = Router();

  router.get('/categories', requireRoles(...READERS), validate({ query: listProductsQuerySchema }), controller.getCategories);
  router.get(
    '/barcode/:barcode',
    requireRoles(...READERS),
    validate({ params: productBarcodeParamsSchema, query: listProductsQuerySchema }),
    controller.findByBarcode,
  );
  router.get('/', requireRoles(...READERS), validate({ query: listProductsQuerySchema }), controller.findAll);
  router.get('/:id', requireRoles(...READERS), validate({ params: productIdParamsSchema }), controller.findOne);
  router.post('/', requireRoles(...WRITERS), validate({ body: createProductSchema }), controller.create);
  router.put(
    '/:id',
    requireRoles(...WRITERS),
    validate({ params: productIdParamsSchema, body: updateProductSchema }),
    controller.update,
  );
  router.delete('/:id', requireRoles(...WRITERS), validate({ params: productIdParamsSchema }), controller.remove);

  return router;
}

export const productsRouter = createProductsRouter();
