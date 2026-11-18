import { Router } from 'express';
import { requireRoles } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import { ordersController, OrdersController } from './orders.controller';
import {
  billNoParamsSchema,
  cancelOrderSchema,
  createOrderSchema,
  listOrdersQuerySchema,
  orderIdParamsSchema,
  quoteOrderSchema,
  updateOrderSchema,
  validatePromotionSchema,
} from './orders.schema';

const SELLERS = ['superuser', 'admin', 'cashier', 'customer'];
/** Everyone whose daily work starts from an order can read orders. */
const READERS = ['superuser', 'admin', 'cashier', 'returnhandler', 'deliveryops', 'inventorymanager'];
const EDITORS = ['superuser', 'admin', 'cashier'];
const MANAGERS = ['superuser', 'admin'];

/**
 * Orders Module Router
 *
 * Literal paths are registered before '/:id'. Bills and payments are created
 * by the checkout itself, so there are no POST routes for them.
 */
export function createOrdersRouter(controller: OrdersController = ordersController): Router {
  const router = Router();

  router.post('/promotions/validate', requireRoles(...SELLERS), validate({ body: validatePromotionSchema }), controller.validatePromotion);
  router.post('/quote', requireRoles(...SELLERS), validate({ body: quoteOrderSchema }), controller.quote);
  router.get('/bills/all', requireRoles(...EDITORS), controller.findAllBills);
  router.get('/bills/:billNo', requireRoles(...EDITORS), validate({ params: billNoParamsSchema }), controller.findOneBill);
  router.get('/payments/all', requireRoles(...EDITORS), controller.findAllPayments);
  router.get('/payments/:billNo', requireRoles(...EDITORS), validate({ params: billNoParamsSchema }), controller.findOnePayment);

  router.get('/', requireRoles(...READERS), validate({ query: listOrdersQuerySchema }), controller.findAll);
  router.post('/', requireRoles(...SELLERS), validate({ body: createOrderSchema }), controller.create);
  router.get('/:id', requireRoles(...READERS), validate({ params: orderIdParamsSchema }), controller.findOne);
  router.put(
    '/:id',
    requireRoles(...EDITORS),
    validate({ params: orderIdParamsSchema, body: updateOrderSchema }),
    controller.update,
  );
  router.post(
    '/:id/cancel',
    requireRoles(...MANAGERS),
    validate({ params: orderIdParamsSchema, body: cancelOrderSchema }),
    controller.cancel,
  );
  router.delete('/:id', requireRoles(...MANAGERS), validate({ params: orderIdParamsSchema }), controller.remove);

  return router;
}

export const ordersRouter = createOrdersRouter();
