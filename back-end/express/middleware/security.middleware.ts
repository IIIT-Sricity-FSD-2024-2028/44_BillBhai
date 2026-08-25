import { RequestHandler } from 'express';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { config } from '../config/index';
import { logger } from '../utils/logger';

/**
 * Security Middleware (helmet + express-rate-limit)
 *
 * helmet sets the standard hardening response headers (HSTS, X-Frame-Options,
 * X-Content-Type-Options, Referrer-Policy, a restrictive CSP, and so on).
 * express-rate-limit protects the API surface from brute force and floods.
 */

export const helmetMiddleware: RequestHandler = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'no-referrer' },
});

/** Swagger UI ships inline assets that the strict CSP above would block. */
export const swaggerCspOverride: RequestHandler = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
});

/** Global limiter applied to the whole /api surface. */
export const apiRateLimiter: RequestHandler = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.max,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => config.isTest,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      requestId: req.requestId,
      ip: req.ip,
      url: req.originalUrl,
    });
    res.status(429).json({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please retry in a moment.',
      requestId: req.requestId,
    });
  },
});

/** Much tighter limiter for the credential endpoint. */
export const authRateLimiter: RequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => config.isTest,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? '')}:${String(req.body?.username ?? '')}`,
  handler: (req, res) => {
    logger.warn('Login rate limit exceeded', {
      requestId: req.requestId,
      ip: req.ip,
      username: req.body?.username,
    });
    res.status(429).json({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Too many login attempts. Please try again later.',
      requestId: req.requestId,
    });
  },
});
