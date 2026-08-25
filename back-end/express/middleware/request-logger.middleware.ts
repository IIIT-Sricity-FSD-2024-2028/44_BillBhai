import { Request, Response } from 'express';
import morgan, { StreamOptions } from 'morgan';
import { config } from '../config/index';
import { logger, morganStream } from '../utils/logger';

/**
 * HTTP Request Logging Middleware (morgan -> winston -> rotating log file)
 *
 * morgan produces one structured access line per request; that line is piped
 * into winston rather than stdout, so it lands in
 * `logs/application-YYYY-MM-DD.log` alongside everything else.
 */

morgan.token('requestId', (req) => (req as Request).requestId || '-');
morgan.token('role', (req) => (req as Request).auth?.role || 'anonymous');

const ACCESS_FORMAT =
  ':requestId :remote-addr :role :method :url :status :res[content-length]b :response-time ms';

export const requestLogger = morgan(ACCESS_FORMAT, {
  stream: morganStream as StreamOptions,
  skip: () => config.isTest,
});

/**
 * Slow-request watchdog. Anything over the threshold is escalated to `warn`
 * so it is easy to find in the error/warn stream during evaluation.
 */
const SLOW_REQUEST_MS = 1000;

export function slowRequestLogger(
  req: Request,
  res: Response,
  next: () => void,
): void {
  res.on('finish', () => {
    const durationMs = Date.now() - (req.receivedAt || Date.now());
    if (durationMs >= SLOW_REQUEST_MS) {
      logger.warn('Slow request detected', {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        durationMs,
      });
    }
  });
  next();
}
