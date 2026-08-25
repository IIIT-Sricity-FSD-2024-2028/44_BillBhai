import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

/**
 * Request Context Middleware
 *
 * Stamps every inbound request with a correlation id and a receive timestamp,
 * then echoes the id back on the response as `x-request-id`.
 *
 * Because this runs first, the same id appears on the morgan access line, on
 * every winston entry written while handling the request, and in the JSON body
 * of any error response - which is what makes a log file traceable end to end.
 */
export function requestContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const incoming = req.headers['x-request-id'];
  const requestId =
    typeof incoming === 'string' && incoming.trim().length > 0
      ? incoming.trim()
      : randomUUID();

  req.requestId = requestId;
  req.receivedAt = Date.now();
  res.setHeader('x-request-id', requestId);

  next();
}
