import { NextFunction, Request, Response } from 'express';
import { NotFoundError } from '../errors/http-error';

/**
 * 404 Handler
 *
 * Registered after every router. Converts an unmatched route into a NotFound
 * error so it travels through the same logging and JSON formatting pipeline as
 * every other failure, rather than falling through to Express's HTML page.
 */
export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  next(new NotFoundError(`Cannot ${req.method} ${req.originalUrl}`));
};
