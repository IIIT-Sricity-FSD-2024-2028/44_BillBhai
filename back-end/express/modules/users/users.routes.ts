import { Router } from 'express';
import { requireRoles, ROLES } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validate.middleware';
import { usersController, UsersController } from './users.controller';
import {
  changePasswordSchema,
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
  userIdParamsSchema,
} from './users.schema';

const MANAGERS = ['superuser', 'admin'];

/** Users Module Router. '/me' routes are registered before '/:id'. */
export function createUsersRouter(controller: UsersController = usersController): Router {
  const router = Router();
  router.get('/me', requireRoles(...ROLES), controller.me);
  router.put('/me/password', requireRoles(...ROLES), validate({ body: changePasswordSchema }), controller.changeOwnPassword);
  router.get('/', requireRoles(...MANAGERS), validate({ query: listUsersQuerySchema }), controller.findAll);
  router.get('/:id', requireRoles(...MANAGERS), validate({ params: userIdParamsSchema }), controller.findOne);
  router.post('/', requireRoles(...MANAGERS), validate({ body: createUserSchema }), controller.create);
  router.put(
    '/:id',
    requireRoles(...MANAGERS),
    validate({ params: userIdParamsSchema, body: updateUserSchema }),
    controller.update,
  );
  router.post('/:id/reset-password', requireRoles(...MANAGERS), validate({ params: userIdParamsSchema }), controller.resetPassword);
  router.delete('/:id', requireRoles(...MANAGERS), validate({ params: userIdParamsSchema }), controller.remove);
  return router;
}

export const usersRouter = createUsersRouter();
