import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index';

/**
 * Basic CORS middleware to allow cross-origin requests from frontends and tooling.
 */
export function corsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.header('Access-Control-Allow-Origin', config.cors.origin);
  res.header('Access-Control-Allow-Methods', config.cors.methods.join(', '));
  res.header(
    'Access-Control-Allow-Headers',
    config.cors.allowedHeaders.join(', '),
  );

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
}
