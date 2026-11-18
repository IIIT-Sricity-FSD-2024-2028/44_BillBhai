import { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Wraps a controller body: runs it (sync or async), sends what it returns as
 * JSON with the given status, and forwards any error to the error pipeline.
 */
export function handle(
  fn: (req: Request, res: Response) => unknown | Promise<unknown>,
  status = 200,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve()
      .then(() => fn(req, res))
      .then((body) => {
        if (!res.headersSent) res.status(status).json(body);
      })
      .catch(next);
  };
}

export function param(req: Request, name: string): string {
  return String(req.params[name] ?? '');
}

export function query(req: Request, name: string): string | undefined {
  const value = (req.query as Record<string, unknown>)[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
