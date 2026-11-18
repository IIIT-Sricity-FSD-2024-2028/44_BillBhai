import { Router } from 'express';
import { requireRoles, ROLES } from '../../middleware/rbac.middleware';
import { authRateLimiter } from '../../middleware/security.middleware';
import { validate } from '../../middleware/validate.middleware';
import { companiesController, CompaniesController } from './companies.controller';
import {
  cancelSubscriptionSchema,
  changePlanSchema,
  companyIdParamsSchema,
  createCompanySchema,
  registerCompanySchema,
  updateCompanySchema,
} from './companies.schema';

/** Companies Module Router. '/register' is public; it signs the new admin in. */
export function createCompaniesRouter(controller: CompaniesController = companiesController): Router {
  const router = Router();
  router.post('/register', authRateLimiter, validate({ body: registerCompanySchema }), controller.register);
  router.get('/', requireRoles('superuser'), controller.findAll);
  router.get('/me/profile', requireRoles(...ROLES), controller.myProfile);
  router.get('/:id', requireRoles('superuser', 'admin'), validate({ params: companyIdParamsSchema }), controller.findOne);
  router.post('/', requireRoles('superuser'), validate({ body: createCompanySchema }), controller.create);
  router.put(
    '/:id',
    requireRoles('superuser', 'admin'),
    validate({ params: companyIdParamsSchema, body: updateCompanySchema }),
    controller.update,
  );
  router.post(
    '/:id/plan',
    requireRoles('superuser', 'admin'),
    validate({ params: companyIdParamsSchema, body: changePlanSchema }),
    controller.changePlan,
  );
  router.post(
    '/:id/cancel-subscription',
    requireRoles('superuser', 'admin'),
    validate({ params: companyIdParamsSchema, body: cancelSubscriptionSchema }),
    controller.cancelSubscription,
  );
  router.delete('/:id', requireRoles('superuser'), validate({ params: companyIdParamsSchema }), controller.remove);
  return router;
}

export const companiesRouter = createCompaniesRouter();
