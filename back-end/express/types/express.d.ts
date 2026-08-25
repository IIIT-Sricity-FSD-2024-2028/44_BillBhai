import 'express';

/**
 * Ambient augmentation of the Express Request object.
 *
 * Populated by requestContextMiddleware (requestId, receivedAt) and by
 * rbacMiddleware / authenticate (auth). Declared once here so every module
 * gets the same typed contract.
 */
declare global {
  namespace Express {
    interface AuthenticatedActor {
      id?: string;
      username?: string;
      role: string;
      companyId?: string;
      source: 'jwt' | 'x-role';
    }

    interface Request {
      requestId: string;
      receivedAt: number;
      auth?: AuthenticatedActor;
    }
  }
}

export {};
