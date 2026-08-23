import { Request, Response, NextFunction } from 'express';

/**
 * Standard HTTP request logging middleware.
 * Logs method, URL, status code, and response duration in ms.
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const startedAt = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    console.log(
      `[HTTP] ${req.method} ${req.originalUrl || req.url} -> ${res.statusCode} (${durationMs}ms)`,
    );
  });
  next();
}
