'use strict';
const config = require('../config');
const logger = require('../logger');

/**
 * errorHandler
 * Global Express error handler (4-argument function).
 * Must be registered LAST with app.use().
 * Never exposes stack traces in production.
 *
 * All errors are written to both the console and the daily-rotating
 * logs/error-YYYY-MM-DD.log file via the shared Winston logger.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';

  const meta = {
    requestId:  req.requestId || '-',
    method:     req.method,
    url:        req.url,
    statusCode: status,
  };

  if (status >= 500) {
    logger.error(`[ERROR] [${meta.requestId}] ${meta.method} ${meta.url} -> ${status}: ${message}`, {
      ...meta,
      stack: err.stack,
    });
  } else {
    logger.warn(`[WARN]  [${meta.requestId}] ${meta.method} ${meta.url} -> ${status}: ${message}`, meta);
  }

  const body: Record<string, any> = {
    statusCode: status,
    timestamp:  new Date().toISOString(),
    path:       req.originalUrl || req.url,
    requestId:  req.requestId || null,
    message,
  };

  if (config.isDev && status >= 500 && err.stack) {
    body.stack = err.stack;
  }

  res.status(status).json(body);
}

module.exports = { errorHandler };
