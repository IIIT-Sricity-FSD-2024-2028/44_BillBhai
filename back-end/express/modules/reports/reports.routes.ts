import { Router } from 'express';
import { requireRoles } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import { reportsController, ReportsController } from './reports.controller';
import { reportQuerySchema } from './reports.schema';

/** Reports Module Router */
export function createReportsRouter(controller: ReportsController = reportsController): Router {
  const router = Router();
  router.get(
    '/sales',
    requireRoles('superuser', 'admin', 'cashier'),
    validate({ query: reportQuerySchema }),
    controller.getSalesReport,
  );
  router.get(
    '/inventory',
    requireRoles('superuser', 'admin', 'inventorymanager'),
    validate({ query: reportQuerySchema }),
    controller.getInventoryReport,
  );
  router.get(
    '/returns',
    requireRoles('superuser', 'admin', 'returnhandler'),
    validate({ query: reportQuerySchema }),
    controller.getReturnsReport,
  );
  return router;
}

export const reportsRouter = createReportsRouter();
