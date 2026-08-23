'use strict';
const cors = require('cors');
const config = require('../config');

const allowedOrigins = config.corsOrigins;

const corsConfig = cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.warn(`[CORS] Blocked request from origin: ${origin}`);
    callback(new Error(`CORS policy: origin '${origin}' is not allowed.`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-role'],
  exposedHeaders: ['X-Request-Id'],
  credentials: false,
  maxAge: 86400,
});

module.exports = { corsConfig, allowedOrigins };
