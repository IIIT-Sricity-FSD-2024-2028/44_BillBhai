'use strict';
const helmet = require('helmet');
const config = require('../config');

const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      scriptSrc:  ["'none'"],
      styleSrc:   ["'none'"],
      imgSrc:     ["'none'"],
      connectSrc: ["'none'"],
      fontSrc:    ["'none'"],
      objectSrc:  ["'none'"],
      mediaSrc:   ["'none'"],
      frameSrc:   ["'none'"],
    },
  },
  strictTransportSecurity: !config.isDev
    ? { maxAge: 31536000, includeSubDomains: true }
    : false,
  xContentTypeOptions: true,
  xFrameOptions: { action: 'deny' },
  xXssProtection: false,
  referrerPolicy: { policy: 'no-referrer' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  crossOriginEmbedderPolicy: false,
});

const swaggerCspOverride = helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc:  ["'self'", "'unsafe-inline'"],
    styleSrc:   ["'self'", "'unsafe-inline'"],
    imgSrc:     ["'self'", 'data:'],
    connectSrc: ["'self'"],
    fontSrc:    ["'self'"],
    objectSrc:  ["'none'"],
  },
});

module.exports = { helmetMiddleware, swaggerCspOverride };
