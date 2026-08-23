'use strict';

/**
 * notFoundHandler
 * Catches requests that don't match any registered route.
 * Register BEFORE errorHandler but AFTER all routes.
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    statusCode: 404,
    timestamp: new Date().toISOString(),
    path: req.originalUrl || req.url,
    requestId: req.requestId || null,
    message: `Cannot ${req.method} ${req.originalUrl || req.url}`,
  });
}

module.exports = { notFoundHandler };
