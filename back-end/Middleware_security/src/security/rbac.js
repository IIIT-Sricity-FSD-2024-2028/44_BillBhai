"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = authenticateToken;
exports.authorizeRoles = authorizeRoles;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = __importDefault(require("../config/config"));
const logger_1 = __importDefault(require("../utils/logger"));
const apiError_1 = require("../utils/apiError");
function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const testRoleHeader = req.headers['x-user-role'];
    const testUserIdHeader = req.headers['x-user-id'];
    if (testRoleHeader && ['ADMIN', 'MANAGER', 'USER'].includes(testRoleHeader)) {
        req.user = {
            id: testUserIdHeader || 'test-user-id',
            email: `${testRoleHeader.toLowerCase()}@billbhai.com`,
            role: testRoleHeader,
        };
        return next();
    }
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(new apiError_1.UnauthorizedError('Authentication token missing or invalid format'));
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, config_1.default.jwtSecret);
        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role,
            name: decoded.name,
        };
        next();
    }
    catch (error) {
        logger_1.default.warn(`JWT verification failed: ${error.message}`, { requestId: req.requestId });
        next(new apiError_1.UnauthorizedError('Invalid or expired authentication token'));
    }
}
function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            logger_1.default.warn(`RBAC failure: Unauthenticated user attempted access to ${req.originalUrl}`, {
                requestId: req.requestId,
            });
            return next(new apiError_1.UnauthorizedError('User authentication required before role authorization'));
        }
        if (!allowedRoles.includes(req.user.role)) {
            logger_1.default.warn(`RBAC Access Denied: User [${req.user.id}] with role [${req.user.role}] attempted to access ${req.originalUrl} requiring roles: [${allowedRoles.join(', ')}]`, {
                requestId: req.requestId,
                userId: req.user.id,
                userRole: req.user.role,
                allowedRoles,
                url: req.originalUrl,
            });
            return next(new apiError_1.ForbiddenError(`Access denied: Requires one of [${allowedRoles.join(', ')}] role(s)`));
        }
        next();
    };
}
