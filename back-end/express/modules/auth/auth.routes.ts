import { Router } from 'express';
import { requireRoles, ROLES } from '../../middleware/rbac.middleware';
import { authRateLimiter } from '../../middleware/security.middleware';
import { validate } from '../../middleware/validate.middleware';
import { authController, AuthController } from './auth.controller';
import { loginSchema } from './auth.schema';

/**
 * Auth Module Router
 *
 * POST /login carries a dedicated, much tighter rate limiter than the rest of
 * the API - ten attempts per fifteen minutes per IP and username pair.
 */
export function createAuthRouter(
  controller: AuthController = authController,
): Router {
  const router = Router();

  router.post(
    '/login',
    authRateLimiter,
    validate({ body: loginSchema }),
    controller.login,
  );

  router.get('/profile', requireRoles(...ROLES), controller.profile);

  return router;
}

export const authRouter = createAuthRouter();
