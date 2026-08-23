"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadRateLimiter = exports.strictRateLimiter = exports.globalRateLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const config_1 = __importDefault(require("../config/config"));
const logger_1 = __importDefault(require("../utils/logger"));
const apiError_1 = require("../utils/apiError");
const createRateLimiterHandler = (limiterName) => {
    return (req, res, next) => {
        const clientIp = req.clientIp || req.ip;
        logger_1.default.warn(`Rate limit exceeded [${limiterName}] for IP: ${clientIp} on ${req.originalUrl}`, {
            requestId: req.requestId,
            ip: clientIp,
            url: req.originalUrl,
        });
        next(new apiError_1.RateLimitError(`Too many requests for ${limiterName}. Please try again later.`));
    };
};
exports.globalRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: config_1.default.throttle.global.windowMs,
    max: config_1.default.throttle.global.limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: createRateLimiterHandler('Global Rate Limiter'),
});
exports.strictRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: config_1.default.throttle.strict.windowMs,
    max: config_1.default.throttle.strict.limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: createRateLimiterHandler('Strict Endpoint Rate Limiter'),
});
exports.uploadRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: createRateLimiterHandler('Upload Rate Limiter'),
});
