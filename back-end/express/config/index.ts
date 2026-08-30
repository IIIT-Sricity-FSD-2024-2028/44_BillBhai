/**
 * Centralised Application Configuration
 *
 * Single source of truth for every environment-driven value in the Express
 * runtime. Modules MUST import `config` from here and MUST NOT read
 * `process.env` directly (see ARCHITECTURE.md section 5).
 */

function toNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toList(value: string | undefined, fallback: string[]): string[] {
  if (!value) return fallback;
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  isProduction: boolean;
  isTest: boolean;
  apiPrefix: string;
  cors: {
    origins: string[];
    methods: string[];
    allowedHeaders: string[];
    credentials: boolean;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  logging: {
    dir: string;
    level: string;
    maxSize: string;
    maxFiles: string;
    datePattern: string;
  };
  uploads: {
    dir: string;
    maxFileSizeBytes: number;
    allowedImageTypes: string[];
    allowedImportTypes: string[];
  };
  auth: {
    jwtSecret: string;
    jwtExpiresIn: string;
    bcryptRounds: number;
  };
  razorpay: {
    keyId: string;
    keySecret: string;
    webhookSecret: string;
  };
  swaggerEnabled: boolean;
}

const nodeEnv = process.env.NODE_ENV || 'development';

export const config: AppConfig = Object.freeze({
  // 4000 so the Express runtime can run side by side with the NestJS
  // backend on 3000 during the migration, instead of fighting for a port.
  port: toNumber(process.env.PORT, 4000),
  nodeEnv,
  isProduction: nodeEnv === 'production',
  isTest: nodeEnv === 'test',
  apiPrefix: process.env.API_PREFIX || '/api',

  cors: {
    origins: toList(process.env.CORS_ORIGIN, [
      'http://127.0.0.1:5500',
      'http://localhost:5500',
      'http://127.0.0.1:3000',
      'http://localhost:3000',
    ]),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-role', 'x-request-id'],
    credentials: true,
  },

  rateLimit: {
    windowMs: toNumber(process.env.RATE_LIMIT_WINDOW_MS, 60 * 1000),
    max: toNumber(process.env.RATE_LIMIT_MAX, 200),
  },

  logging: {
    dir: process.env.LOG_DIR || 'logs',
    level: process.env.LOG_LEVEL || (nodeEnv === 'production' ? 'info' : 'debug'),
    maxSize: process.env.LOG_MAX_SIZE || '10m',
    maxFiles: process.env.LOG_MAX_FILES || '14d',
    datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD',
  },

  uploads: {
    dir: process.env.UPLOAD_DIR || 'uploads',
    maxFileSizeBytes: toNumber(process.env.UPLOAD_MAX_BYTES, 5 * 1024 * 1024),
    allowedImageTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
    allowedImportTypes: ['text/csv', 'application/vnd.ms-excel', 'text/plain'],
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET || 'billbhai-dev-secret-change-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
    bcryptRounds: toNumber(process.env.BCRYPT_ROUNDS, 10),
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_TW4VajO27O0KT4',
    keySecret: process.env.RAZORPAY_KEY_SECRET || 'Vzr85w9GRVA29bIH0gzaVBkK',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || 'Vzr85w9GRVA29bIH0gzaVBkK',
  },

  swaggerEnabled: process.env.SWAGGER_ENABLED
    ? process.env.SWAGGER_ENABLED === 'true'
    : nodeEnv !== 'production',
});
