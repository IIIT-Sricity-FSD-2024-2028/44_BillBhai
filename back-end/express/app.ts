import express, { Express, Request, Response } from 'express';
import { config } from './config/index';
import { corsMiddleware, requestLogger } from './middleware/index';
import { apiRouter } from './routes/index';

/**
 * Creates and configures the Express application instance.
 *
 * Responsibilities:
 * - Registers global body parsers (JSON, urlencoded).
 * - Attaches global infrastructure middleware (request logger, CORS).
 * - Configures top-level root redirect (GET / -> /api).
 * - Mounts the central API router under the configured API prefix.
 *
 * NOTE: Server listening and lifecycle management belong in server.ts.
 */
export function createApp(): Express {
  const app = express();

  // 1. Global Parsers
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 2. Global Middleware
  app.use(requestLogger);
  app.use(corsMiddleware);

  // 3. Root Route (Redirects to API prefix, matching legacy NestJS root behavior)
  app.get('/', (req: Request, res: Response) => {
    res.redirect(301, config.apiPrefix);
  });

  // 4. Mount Central API Router
  app.use(config.apiPrefix, apiRouter);

  return app;
}

export const app: Express = createApp();
