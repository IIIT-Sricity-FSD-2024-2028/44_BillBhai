import cors from 'cors';
import { RequestHandler } from 'express';
import { config } from '../config/index';

/**
 * CORS Middleware (cors package)
 *
 * Replaces the hand-rolled header writer with an explicit origin allowlist.
 * Requests with no Origin header (curl, Postman, server-to-server, Swagger UI
 * on the same host) are allowed so the API stays testable from the terminal.
 */
export const corsMiddleware: RequestHandler = cors({
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (config.cors.origins.includes('*') || config.cors.origins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin ${origin} is not allowed by the CORS policy`));
  },
  methods: config.cors.methods,
  allowedHeaders: config.cors.allowedHeaders,
  exposedHeaders: ['x-request-id', 'RateLimit-Limit', 'RateLimit-Remaining'],
  credentials: config.cors.credentials,
  optionsSuccessStatus: 204,
});
