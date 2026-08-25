import path from 'path';
import express, { Express, Request, Response } from 'express';
import { config } from './config/index';
import {
  apiRateLimiter,
  corsMiddleware,
  errorHandler,
  helmetMiddleware,
  notFoundHandler,
  requestContextMiddleware,
  requestLogger,
  slowRequestLogger,
} from './middleware/index';
import { apiRouter } from './routes/index';
import { mountSwagger } from './docs/swagger';

/**
 * Express Application Factory
 *
 * MIDDLEWARE EXECUTION ORDER (top to bottom). The order is deliberate:
 * anything needing a correlation id must run after (1), anything reading the
 * parsed body must run after (4), and the last two must stay last or errors
 * escape the pipeline.
 *
 *   1. requestContextMiddleware - correlation id + receive timestamp
 *   2. helmet                   - security response headers
 *   3. cors                     - cross origin allowlist
 *   4. express.json/urlencoded  - body parsing with a size ceiling
 *   5. morgan -> winston        - one access log line per request, to file
 *   6. slowRequestLogger        - escalates slow requests to warn level
 *   7. express.static           - serves uploaded images and imports
 *   8. rate limiter             - applied to the /api surface only
 *   9. Swagger UI               - interactive API documentation
 *  10. apiRouter                - all feature modules
 *  11. notFoundHandler          - unmatched route becomes a NotFoundError
 *  12. errorHandler             - single JSON error envelope + file logging
 *
 * Server listening and process lifecycle belong in server.ts, not here.
 */
export function createApp(): Express {
  const app = express();

  // Needed for express-rate-limit and req.ip when running behind a proxy.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // 1. Request context
  app.use(requestContextMiddleware);

  // 2 and 3. Security headers, then CORS
  app.use(helmetMiddleware);
  app.use(corsMiddleware);

  // 4. Body parsers with an explicit size ceiling
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 5 and 6. Request logging
  app.use(requestLogger);
  app.use(slowRequestLogger);

  // 7. Static hosting for uploaded assets
  const uploadRoot = path.isAbsolute(config.uploads.dir)
    ? config.uploads.dir
    : path.resolve(process.cwd(), config.uploads.dir);
  app.use('/uploads', express.static(uploadRoot, { index: false }));

  // 8. Rate limiting, scoped to the API surface
  app.use(config.apiPrefix, apiRateLimiter);

  // 9. Interactive documentation at /api/docs
  mountSwagger(app);

  // Liveness probe, deliberately outside the API prefix.
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'UP',
      uptimeSeconds: Math.round(process.uptime()),
      environment: config.nodeEnv,
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    });
  });

  // Root redirect, matching the legacy NestJS behaviour.
  app.get('/', (_req: Request, res: Response) => {
    res.redirect(301, config.apiPrefix);
  });

  // 10. Feature modules
  app.use(config.apiPrefix, apiRouter);

  // 11 and 12. These two MUST stay last.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app: Express = createApp();
