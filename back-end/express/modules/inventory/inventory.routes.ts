import { Router } from 'express';
import { requireRoles } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import { inventoryController, InventoryController } from './inventory.controller';
import {
  adjustStockSchema,
  inventoryIdParamsSchema,
  listInventoryQuerySchema,
  listMovementsQuerySchema,
  productIdParamsSchema,
  receiveStockSchema,
  updateInventorySchema,
} from './inventory.schema';

/** The till needs to read stock too, so cashiers can see what is on the shelf. */
const READERS = ['superuser', 'admin', 'inventorymanager', 'cashier', 'returnhandler', 'customer'];
const MANAGERS = ['superuser', 'admin', 'inventorymanager'];

/**
 * Inventory Module Router
 *
 * Literal paths ('/low-stock', '/movements', '/adjust', '/receive',
 * '/product/:productId') are registered before '/:id'.
 */
export function createInventoryRouter(controller: InventoryController = inventoryController): Router {
  const router = Router();

  router.get('/low-stock', requireRoles(...MANAGERS), validate({ query: listInventoryQuerySchema }), controller.findLowStock);
  router.get('/movements', requireRoles(...MANAGERS), validate({ query: listMovementsQuerySchema }), controller.findMovements);
  router.get(
    '/product/:productId',
    requireRoles(...READERS),
    validate({ params: productIdParamsSchema }),
    controller.findByProduct,
  );
  router.post('/adjust', requireRoles(...MANAGERS), validate({ body: adjustStockSchema }), controller.adjustStock);
  router.post('/receive', requireRoles(...MANAGERS), validate({ body: receiveStockSchema }), controller.receiveStock);
  router.get('/', requireRoles(...READERS), validate({ query: listInventoryQuerySchema }), controller.findAll);
  router.get('/:id', requireRoles(...MANAGERS), validate({ params: inventoryIdParamsSchema }), controller.findOne);
  router.put(
    '/:id',
    requireRoles(...MANAGERS),
    validate({ params: inventoryIdParamsSchema, body: updateInventorySchema }),
    controller.update,
  );
  router.delete('/:id', requireRoles('superuser', 'admin'), validate({ params: inventoryIdParamsSchema }), controller.remove);

  return router;
}

export const inventoryRouter = createInventoryRouter();
