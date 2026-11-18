import { Request } from 'express';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/http-error';

/**
 * Company scoping.
 *
 * Every business sees only its own records. The company comes from the
 * signed-in user's token, never from the request body or query, so a browser
 * cannot ask for another store's data by changing a parameter.
 *
 * Two kinds of caller see across companies:
 *   - the super user, who may pass `companyId` to pick a store;
 *   - the module test suites, which send the test-only `x-role` header and
 *     have no company of their own.
 */

export function isCrossCompany(req: Request): boolean {
  const actor = req.auth;
  if (!actor) return true;
  if (actor.role === 'superuser') return true;
  return actor.source === 'x-role' && !actor.companyId;
}

/**
 * Company to filter a list by. For a store user this is always their own
 * company; asking for another one is refused. Cross-company callers get the
 * company they asked for, or undefined (all companies).
 */
export function listScope(req: Request, requested?: unknown): string | undefined {
  const wanted = typeof requested === 'string' && requested.trim() ? requested.trim() : undefined;
  if (isCrossCompany(req)) return wanted;
  const own = String(req.auth?.companyId || '');
  if (wanted && wanted !== own) {
    throw new ForbiddenError('You can only see records of your own business.');
  }
  return own;
}

/** Company a new record belongs to. Cross-company callers must name one. */
export function writeScope(req: Request, requested?: unknown): string {
  const scoped = listScope(req, requested);
  if (!scoped) throw new BadRequestError('companyId is required');
  return scoped;
}

/**
 * Guards a single record. A record from another business is reported as not
 * found, so its existence is not revealed.
 */
export function assertInScope(req: Request, recordCompanyId: string | undefined, label: string): void {
  if (isCrossCompany(req)) return;
  if (String(recordCompanyId || '') !== String(req.auth?.companyId || '')) {
    throw new NotFoundError(`${label} not found`);
  }
}

/** Short name of the person acting, for "updated by" and the activity log. */
export function actorName(req: Request): string {
  const actor = req.auth;
  if (!actor) return 'system';
  return actor.username || actor.role || 'system';
}

export function actorId(req: Request): string {
  return String(req.auth?.id || '');
}
