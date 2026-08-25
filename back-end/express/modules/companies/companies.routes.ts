import { Router } from 'express';
import { requireRoles } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import { companiesController, CompaniesController } from './companies.controller';
import {
  companyIdParamsSchema,
  createCompanySchema,
  updateCompanySchema,
} from './companies.schema';

/**
 * Companies Module Router
 *
 * Router-level middleware chain per endpoint:
 *   requireRoles(...)  -> role based access control
 *   validate({...})    -> zod schema validation
 *   controller.method  -> request handling
 */
export function createCompaniesRouter(
  controller: CompaniesController = companiesController,
): Router {
  const router = Router();

  router.get('/', requireRoles('superuser'), controller.findAll);

  router.get(
    '/:id',
    requireRoles('superuser', 'admin'),
    validate({ params: companyIdParamsSchema }),
    controller.findOne,
  );

  router.post(
    '/',
    requireRoles('superuser'),
    validate({ body: createCompanySchema }),
    controller.create,
  );

  router.put(
    '/:id',
    requireRoles('superuser'),
    validate({ params: companyIdParamsSchema, body: updateCompanySchema }),
    controller.update,
  );

  router.delete(
    '/:id',
    requireRoles('superuser'),
    validate({ params: companyIdParamsSchema }),
    controller.remove,
  );

  return router;
}

export const companiesRouter = createCompaniesRouter();
