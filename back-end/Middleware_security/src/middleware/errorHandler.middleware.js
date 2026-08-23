"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = notFoundHandler;
exports.globalErrorHandler = globalErrorHandler;
const apiError_1 = require("../utils/apiError");
const logger_1 = __importDefault(require("../utils/logger"));
const config_1 = __importDefault(require("../config/config"));
/**
 * 404 Route Not Found Handler
 */
function notFoundHandler(req, res, next) {
    next(new apiError_1.NotFoundError(`Cannot ${req.method} ${req.originalUrl} - Route not found`));
}
/**
 * Global Centralized Error Handling Middleware
 */
function globalErrorHandler(err, req, res, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
next) {
    const requestId = req.requestId || 'unknown-req';
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';
    let details = err.details || null;
    const errorName = err.name || (err instanceof apiError_1.ApiError ? err.constructor.name : 'Error');
    // Format syntax error or bad JSON input
    if (err instanceof SyntaxError && 'body' in err) {
        statusCode = 400;
        message = 'Malformed JSON body in request payload';
    }
    // Log error details to Winston (persisted to logs/error-YYYY-MM-DD.log)
    logger_1.default.error(`Error encountered [${errorName} - ${statusCode}]: ${message}`, {
        requestId,
        name: errorName,
        statusCode,
        url: req.originalUrl,
        method: req.method,
        ip: req.clientIp,
        userId: req.user?.id || 'anonymous',
        details,
        stack: err.stack,
    });
    // Prepare standard error payload
    const errorResponse = {
        success: false,
        error: {
            name: errorName,
            message,
            statusCode,
            requestId,
            timestamp: new Date().toISOString(),
            ...(details && { details }),
            ...(config_1.default.isDev && err.stack && { stack: err.stack }),
        },
    };
    res.status(statusCode).json(errorResponse);
}
