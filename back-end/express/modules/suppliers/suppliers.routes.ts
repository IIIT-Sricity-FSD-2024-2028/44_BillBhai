import { Router } from 'express';
import { requireRoles } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import { suppliersController, SuppliersController } from './suppliers.controller';
import {
  createSupplierSchema,
  listSuppliersQuerySchema,
  supplierIdParamsSchema,
  updateSupplierSchema,
} from './suppliers.schema';

const MANAGERS = ['superuser', 'admin', 'inventorymanager'];

/** Suppliers Module Router */
export function createSuppliersRouter(controller: SuppliersController = suppliersController): Router {
  const router = Router();
  router.get('/', requireRoles(...MANAGERS), validate({ query: listSuppliersQuerySchema }), controller.findAll);
  router.get('/:id', requireRoles(...MANAGERS), validate({ params: supplierIdParamsSchema }), controller.findOne);
  router.post('/', requireRoles(...MANAGERS), validate({ body: createSupplierSchema }), controller.create);
  router.put(
    '/:id',
    requireRoles(...MANAGERS),
    validate({ params: supplierIdParamsSchema, body: updateSupplierSchema }),
    controller.update,
  );
  router.delete('/:id', requireRoles(...MANAGERS), validate({ params: supplierIdParamsSchema }), controller.remove);
  return router;
}

export const suppliersRouter = createSuppliersRouter();
