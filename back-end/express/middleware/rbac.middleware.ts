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
 * Two credential sources are accepted, in priority order:
 *   1. `Authorization: Bearer <jwt>` - issued by POST /api/auth/login.
 *   2. `x-role: <role>` - the legacy header the existing frontend sends.
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
    try {
      const decoded = jwt.verify(token, config.auth.jwtSecret) as JwtPayload;
      return {
        id: decoded.sub,
        username: decoded.username,
        role: normalise(decoded.role),
        companyId: decoded.companyId,
        source: 'jwt',
      };
    } catch {
      throw new UnauthorizedError('Access token is invalid or has expired');
    }
  }

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
        throw new ForbiddenError(
          'Missing "x-role" header. Please provide your role (e.g., admin, cashier) in the request headers.',
        );
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
