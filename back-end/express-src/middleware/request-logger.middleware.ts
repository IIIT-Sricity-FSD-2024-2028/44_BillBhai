'use strict';

const logger = require('../logger');

/**
 * requestLoggerMiddleware
 * Logs every HTTP request: METHOD URL -> STATUS (Nms) [requestId]
 *
 * Writes to both the console (colourised) and the daily-rotating
 * logs/app-YYYY-MM-DD.log file via the shared Winston logger.
 */
function requestLoggerMiddleware(req, res, next) {
  const startedAt = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const { statusCode } = res;
    const requestId = req.requestId || '-';
    const message = `[HTTP] [${requestId}] ${req.method} ${req.originalUrl || req.url} -> ${statusCode} (${durationMs}ms)`;

    if (statusCode >= 500) {
      logger.error(message);
    } else if (statusCode >= 400) {
      logger.warn(message);
    } else {
      logger.info(message);
    }
  });

  next();
}

module.exports = { requestLoggerMiddleware };
