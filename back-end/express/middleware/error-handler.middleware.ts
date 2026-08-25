import { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import { config } from '../config/index';
import { HttpError, BadRequestError, UnauthorizedError } from '../errors/http-error';
import { logger } from '../utils/logger';

/**
 * Global Error Handling Middleware
 *
 * The single exit point for every failure in the application. It:
 *   - normalises third party error types into the HttpError shape,
 *   - writes the failure to the rotating log files via winston,
 *   - returns one consistent JSON envelope, carrying the request id so a
 *     response seen by a user can be found in the log file.
 *
 * Must be registered last in app.ts, after all routers and the 404 handler.
 */

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string;
  requestId: string;
  timestamp: string;
  path: string;
  details?: unknown;
  stack?: string;
}

function normalise(err: unknown): HttpError {
  if (err instanceof HttpError) {
    return err;
  }

  if (err instanceof ZodError) {
    const message = err.issues
      .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
      .join('; ');
    return new BadRequestError(`Validation failed: ${message}`, err.issues);
  }

  if (err instanceof MulterError) {
    return new BadRequestError(`Upload failed: ${err.message}`);
  }

  if (err instanceof SyntaxError && 'body' in err) {
    return new BadRequestError('Request body is not valid JSON');
  }

  if (err instanceof Error) {
    if (err.name === 'TokenExpiredError') {
      return new UnauthorizedError('Access token has expired');
    }
    if (err.name === 'JsonWebTokenError') {
      return new UnauthorizedError('Access token is invalid');
    }
    if (err.message.includes('not allowed by the CORS policy')) {
      return new HttpError(403, err.message, 'Forbidden');
    }
  }

  const message = err instanceof Error ? err.message : 'Unexpected server error';
  return new HttpError(500, message, 'Internal Server Error');
}

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const httpError = normalise(err);
  const isServerError = httpError.statusCode >= 500;

  const logPayload = {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    statusCode: httpError.statusCode,
    role: req.auth?.role,
    ip: req.ip,
    durationMs: req.receivedAt ? Date.now() - req.receivedAt : undefined,
    ...(isServerError ? { stack: httpError.stack } : {}),
  };

  if (isServerError) {
    logger.error(httpError.message, logPayload);
  } else {
    logger.warn(httpError.message, logPayload);
  }

  const body: ErrorBody = {
    statusCode: httpError.statusCode,
    error: httpError.error,
    message:
      isServerError && config.isProduction
        ? 'Internal Server Error'
        : httpError.message,
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
  };

  if (httpError.details !== undefined) {
    body.details = httpError.details;
  }
  if (!config.isProduction && isServerError) {
    body.stack = httpError.stack;
  }

  res.status(httpError.statusCode).json(body);
};
