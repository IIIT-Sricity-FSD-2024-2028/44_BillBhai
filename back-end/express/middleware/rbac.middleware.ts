import { NextFunction, Request, RequestHandler, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index';
import { ForbiddenError, UnauthorizedError } from '../errors/http-error';
import { logger } from '../utils/logger';

/**
 * Role Based Access Control Middleware
 *
 * This is the single shared implementation for the whole Express runtime.
 * Modules attach it at route level (see MIGRATION_RULES.md section 2.1) and
 * never re-implement their own copy.
 *
 * Credentials:
 *   1. `Authorization: Bearer <jwt>` - issued by POST /api/auth/login. This is
 *      the only credential the running app accepts.
 *   2. `x-role: <role>` - accepted ONLY when NODE_ENV=test, so the module test
 *      suites can call routes without logging in. A header any client can set
 *      is not a credential, so it is refused everywhere else.
 */

export const ROLES = [
  'superuser',
  'admin',
  'cashier',
  'inventorymanager',
  'deliveryops',
  'returnhandler',
  'customer',
] as const;

export type Role = (typeof ROLES)[number];

export interface JwtPayload {
  sub: string;
  username: string;
  role: string;
  companyId?: string;
}

/**
 * Lets the users module confirm a token still belongs to an active account,
 * so deleting or suspending someone ends their session at once instead of
 * when the token expires. Registered by users.service to avoid an import cycle.
 */
type ActorCheck = (actor: { id?: string; role: string; companyId?: string }) => void;
let actorCheck: ActorCheck | null = null;
export function registerActorCheck(check: ActorCheck): void {
  actorCheck = check;
}

function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.auth.jwtSecret, {
    expiresIn: config.auth.jwtExpiresIn,
  } as jwt.SignOptions);
}

/** Resolves the acting user from a bearer token or the legacy role header. */
function resolveActor(req: Request): Express.AuthenticatedActor | null {
  const header = req.headers.authorization;

  if (header && header.startsWith('Bearer ')) {
    const token = header.slice('Bearer '.length).trim();
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, config.auth.jwtSecret) as JwtPayload;
    } catch {
      throw new UnauthorizedError('Your session has expired. Please sign in again.');
    }
    const actor: Express.AuthenticatedActor = {
      id: decoded.sub,
      username: decoded.username,
      role: normalise(decoded.role),
      companyId: decoded.companyId,
      source: 'jwt',
    };
    if (actorCheck) actorCheck(actor);
    return actor;
  }

  // A header any client can set is not a credential: tests only.
  if (!config.isTest) return null;
  const roleHeader = req.headers['x-role'];
  const rawRole = Array.isArray(roleHeader) ? roleHeader[0] : roleHeader;
  if (rawRole && String(rawRole).trim()) {
    return { role: normalise(String(rawRole)), source: 'x-role' };
  }

  return null;
}

/**
 * Populates `req.auth` when a credential is present, without rejecting the
 * request when one is not. Useful for endpoints that behave differently for
 * signed-in users but do not require a session.
 */
export const attachActor: RequestHandler = (req, _res, next) => {
  try {
    const actor = resolveActor(req);
    if (actor) req.auth = actor;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Route level guard. Rejects with 401 when no credential is supplied and 403
 * when the credential carries a role that is not in the allowlist.
 */
export function requireRoles(...allowedRoles: string[]): RequestHandler {
  const allowlist = allowedRoles.map(normalise);

  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const actor = resolveActor(req);

      if (!actor) {
        // PARITY NOTE: the NestJS RolesGuard answered a missing credential with
        // 403 and this exact wording, so the Express runtime does the same
        // rather than the arguably more correct 401. An invalid or expired
        // bearer token still yields 401, since that path is new.
        throw new UnauthorizedError('Please sign in to continue.');
      }

      req.auth = actor;

      if (!allowlist.includes(actor.role)) {
        logger.warn('RBAC denial', {
          requestId: req.requestId,
          method: req.method,
          url: req.originalUrl,
          role: actor.role,
          required: allowedRoles,
        });
        throw new ForbiddenError(
          `Access denied. This action requires one of the following roles: ${allowedRoles.join(', ')}. Your current role is: ${actor.role}`,
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
