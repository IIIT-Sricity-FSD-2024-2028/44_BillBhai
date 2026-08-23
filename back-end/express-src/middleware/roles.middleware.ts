'use strict';

const VALID_ROLES = [
  'superuser',
  'admin',
  'cashier',
  'inventorymanager',
  'deliveryops',
  'returnhandler',
  'customer',
];

/**
 * roles(...requiredRoles)
 * Factory function — returns Express middleware that enforces x-role header.
 * Usage: router.get('/', roles('admin', 'superuser'), handler)
 */
function roles(...requiredRoles) {
  return (req, res, next) => {
    if (!requiredRoles || requiredRoles.length === 0) return next();

    const userRole = req.userRole ||
      (() => {
        const h = req.headers['x-role'];
        const v = Array.isArray(h) ? h[0] : h;
        return v ? String(v).trim().toLowerCase().replace(/\s+/g, '') : null;
      })();

    if (!userRole) {
      return res.status(403).json({
        statusCode: 403,
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        requestId: req.requestId || null,
        message: 'Missing "x-role" header. Please provide your role (e.g., admin, cashier).',
      });
    }

    if (!VALID_ROLES.includes(userRole)) {
      return res.status(403).json({
        statusCode: 403,
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        requestId: req.requestId || null,
        message: `Unknown role: "${userRole}". Valid roles are: ${VALID_ROLES.join(', ')}.`,
      });
    }

    const allowed = requiredRoles.map((r) => r.toLowerCase().replace(/\s+/g, ''));
    if (!allowed.includes(userRole)) {
      return res.status(403).json({
        statusCode: 403,
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        requestId: req.requestId || null,
        message: `Access denied. Required: [${requiredRoles.join(', ')}]. Your role: "${userRole}".`,
      });
    }

    next();
  };
}

module.exports = { roles, VALID_ROLES };
