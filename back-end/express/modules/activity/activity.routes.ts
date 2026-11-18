import { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';
import { requireRoles } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import { listScope } from '../../utils/scope';
import { activityService, ActivityService } from './activity.service';

const listActivityQuerySchema = z.object({
  companyId: z.string().optional(),
  entity: z.string().optional(),
  entityId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

/**
 * GET /activity?entity=order&entityId=ORD-4829
 *
 * Every signed-in staff role may read the history of records in its own
 * business, so a cashier can see who edited a bill and an inventory manager
 * can see who changed a price.
 */
export function createActivityRouter(service: ActivityService = activityService): Router {
  const router = Router();
  router.get(
    '/',
    requireRoles('superuser', 'admin', 'cashier', 'inventorymanager', 'deliveryops', 'returnhandler'),
    validate({ query: listActivityQuerySchema }),
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const q = req.query as unknown as z.infer<typeof listActivityQuerySchema>;
        res.status(200).json(
          service.find({
            companyId: listScope(req, q.companyId),
            entity: q.entity,
            entityId: q.entityId,
            limit: q.limit,
          }),
        );
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
}

export const activityRouter = createActivityRouter();
