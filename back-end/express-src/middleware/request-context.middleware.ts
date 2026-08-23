'use strict';
const { randomUUID } = require('crypto');

/**
 * requestContextMiddleware
 * Attaches req.requestId, req.userRole, req.receivedAt to every request.
 * Must be the FIRST middleware applied.
 */
function requestContextMiddleware(req, res, next) {
  const existingId = req.headers['x-request-id'];
  const requestId =
    typeof existingId === 'string' && existingId.trim()
      ? existingId.trim()
      : randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const rawRole = req.headers['x-role'];
  const roleValue = Array.isArray(rawRole) ? rawRole[0] : rawRole;
  req.userRole = roleValue
    ? String(roleValue).trim().toLowerCase().replace(/\s+/g, '')
    : null;

  req.receivedAt = new Date().toISOString();
  next();
}

module.exports = { requestContextMiddleware };
