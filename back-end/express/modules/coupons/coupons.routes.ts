import { Router } from 'express';
import { requireRoles } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import { couponsController, CouponsController } from './coupons.controller';
import {
  couponAnalyticsQuerySchema,
  couponIdParamsSchema,
  createCouponSchema,
  listCouponsQuerySchema,
  updateCouponSchema,
  validateCouponSchema,
} from './coupons.schema';

const MANAGERS = ['superuser', 'admin'];
const READERS = [...MANAGERS, 'cashier'];

/** Coupons Module Router */
export function createCouponsRouter(controller: CouponsController = couponsController): Router {
  const router = Router();
  router.get('/analytics', requireRoles(...MANAGERS), validate({ query: couponAnalyticsQuerySchema }), controller.analytics);
  router.post('/validate', requireRoles(...READERS, 'customer'), validate({ body: validateCouponSchema }), controller.validate);
  router.get('/', requireRoles(...READERS), validate({ query: listCouponsQuerySchema }), controller.findAll);
  router.get('/:id', requireRoles(...READERS), validate({ params: couponIdParamsSchema }), controller.findOne);
  router.post('/', requireRoles(...MANAGERS), validate({ body: createCouponSchema }), controller.create);
  router.put(
    '/:id',
    requireRoles(...MANAGERS),
    validate({ params: couponIdParamsSchema, body: updateCouponSchema }),
    controller.update,
  );
  router.delete('/:id', requireRoles(...MANAGERS), validate({ params: couponIdParamsSchema }), controller.remove);
  return router;
}

export const couponsRouter = createCouponsRouter();
