import { Router } from 'express';
import { requireRoles } from '../../middleware/rbac.middleware';
import { reportsController, ReportsController } from './reports.controller';

/**
 * Reports Module Router
 *
 * Router-level middleware chain per endpoint:
 *   requireRoles(...)  -> role based access control
 *   controller.method  -> request handling
 *
 * No validate() step: these endpoints accept no params, query string or body.
 */
export function createReportsRouter(
  controller: ReportsController = reportsController,
): Router {
  const router = Router();

  router.get(
    '/sales',
    requireRoles('superuser', 'admin'),
    controller.getSalesReport,
  );

  router.get(
    '/inventory',
    requireRoles('superuser', 'admin', 'inventorymanager'),
    controller.getInventoryReport,
  );

  router.get(
    '/returns',
    requireRoles('superuser', 'admin', 'returnhandler'),
    controller.getReturnsReport,
  );

  return router;
}

export const reportsRouter = createReportsRouter();
