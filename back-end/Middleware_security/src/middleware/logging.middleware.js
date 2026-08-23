"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLoggerMiddleware = requestLoggerMiddleware;
const logger_1 = __importDefault(require("../utils/logger"));
function requestLoggerMiddleware(req, res, next) {
    const startTime = req.startTime || Date.now();
    const requestId = req.requestId || 'unknown';
    // Log incoming request
    logger_1.default.log('http', `--> ${req.method} ${req.originalUrl}`, {
        requestId,
        ip: req.clientIp,
        userAgent: req.headers['user-agent'],
    });
    // Listen for request completion
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;
        const userId = req.user?.id || 'anonymous';
        const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'http';
        logger_1.default.log(logLevel, `<-- ${req.method} ${req.originalUrl} ${statusCode} ${duration}ms - User:${userId}`, {
            requestId,
            method: req.method,
            url: req.originalUrl,
            statusCode,
            durationMs: duration,
            ip: req.clientIp,
            userId,
            contentLength: res.get('content-length') || 0,
        });
    });
    next();
}
exports.default = requestLoggerMiddleware;
