"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = __importDefault(require("../config/config"));
const security_middleware_1 = require("../middleware/security.middleware");
const apiError_1 = require("../utils/apiError");
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
// Router-level middleware 1: Apply strict rate limiting to all auth endpoints
router.use(security_middleware_1.strictRateLimiter);
// Router-level middleware 2: Request payload validation
const validateAuthBody = (req, res, next) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
        return next(new apiError_1.BadRequestError('Email and password are required fields'));
    }
    if (typeof email !== 'string' || !email.includes('@')) {
        return next(new apiError_1.BadRequestError('Invalid email format'));
    }
    next();
};
/**
 * POST /api/auth/login
 * Generates JWT token with specified role (ADMIN, MANAGER, USER)
 */
router.post('/login', validateAuthBody, (req, res) => {
    const { email, role = 'USER', name = 'BillBhai User' } = req.body;
    const normalizedRole = ['ADMIN', 'MANAGER', 'USER'].includes(role.toUpperCase())
        ? role.toUpperCase()
        : 'USER';
    const token = jsonwebtoken_1.default.sign({
        id: `user-${Date.now()}`,
        email,
        role: normalizedRole,
        name,
    }, config_1.default.jwtSecret, { expiresIn: '24h' });
    logger_1.default.info(`User logged in successfully: ${email} [Role: ${normalizedRole}]`, {
        requestId: req.requestId,
    });
    res.json({
        success: true,
        message: 'Authentication successful',
        data: {
            token,
            user: {
                email,
                role: normalizedRole,
                name,
            },
        },
    });
});
exports.default = router;
