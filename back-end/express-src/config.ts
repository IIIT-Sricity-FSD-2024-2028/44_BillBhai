'use strict';
require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') !== 'production',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5500,http://127.0.0.1:5500')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  swaggerEnabled: process.env.SWAGGER_ENABLED !== 'false',
  throttle: {
    login: {
      windowMs: parseInt(process.env.THROTTLE_LOGIN_TTL_MS || '60000', 10),
      limit: parseInt(process.env.THROTTLE_LOGIN_LIMIT || '5', 10),
    },
    global: {
      windowMs: parseInt(process.env.THROTTLE_GLOBAL_TTL_MS || '60000', 10),
      limit: parseInt(process.env.THROTTLE_GLOBAL_LIMIT || '100', 10),
    },
    strict: {
      windowMs: parseInt(process.env.THROTTLE_STRICT_TTL_MS || '60000', 10),
      limit: parseInt(process.env.THROTTLE_STRICT_LIMIT || '20', 10),
    },
  },
};
