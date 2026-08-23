'use strict';
const rateLimit = require('express-rate-limit');
const config = require('../config');

const baseOptions = {
  standardHeaders: true,
  legacyHeaders: false,
};

const loginRateLimiter = rateLimit({
  ...baseOptions,
  windowMs: config.throttle.login.windowMs,
  max: config.throttle.login.limit,
  message: {
    statusCode: 429,
    timestamp: new Date().toISOString(),
    message: 'Too many login attempts. Please wait 60 seconds before trying again.',
    error: 'Too Many Requests',
  },
});

const apiRateLimiter = rateLimit({
  ...baseOptions,
  windowMs: config.throttle.global.windowMs,
  max: config.throttle.global.limit,
  message: {
    statusCode: 429,
    timestamp: new Date().toISOString(),
    message: 'Too many requests. Please slow down.',
    error: 'Too Many Requests',
  },
});

const strictRateLimiter = rateLimit({
  ...baseOptions,
  windowMs: config.throttle.strict.windowMs,
  max: config.throttle.strict.limit,
  message: {
    statusCode: 429,
    timestamp: new Date().toISOString(),
    message: 'Too many write requests. Please slow down.',
    error: 'Too Many Requests',
  },
});

module.exports = { loginRateLimiter, apiRateLimiter, strictRateLimiter };
