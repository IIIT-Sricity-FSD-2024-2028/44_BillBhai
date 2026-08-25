import { Router } from 'express';
import { requireRoles } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import { usersController, UsersController } from './users.controller';
import {
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
  userIdParamsSchema,
} from './users.schema';

/**
 * Users Module Router
 *
 * Router-level middleware chain per endpoint:
 *   requireRoles(...)  -> role based access control
 *   validate({...})    -> zod schema validation
 *   controller.method  -> request handling
 */
export function createUsersRouter(
  controller: UsersController = usersController,
): Router {
  const router = Router();

  router.get(
    '/',
    requireRoles('superuser', 'admin'),
    validate({ query: listUsersQuerySchema }),
    controller.findAll,
  );

  router.get(
    '/:id',
    requireRoles('superuser', 'admin'),
    validate({ params: userIdParamsSchema }),
    controller.findOne,
  );

  router.post(
    '/',
    requireRoles('superuser', 'admin'),
    validate({ body: createUserSchema }),
    controller.create,
  );

  router.put(
    '/:id',
    requireRoles('superuser', 'admin'),
    validate({ params: userIdParamsSchema, body: updateUserSchema }),
    controller.update,
  );

  router.delete(
    '/:id',
    requireRoles('superuser', 'admin'),
    validate({ params: userIdParamsSchema }),
    controller.remove,
  );

  return router;
}

export const usersRouter = createUsersRouter();
