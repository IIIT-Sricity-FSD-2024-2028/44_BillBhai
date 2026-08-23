"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestContextMiddleware = requestContextMiddleware;
const crypto_1 = __importDefault(require("crypto"));
function requestContextMiddleware(req, res, next) {
    // Extract or generate unique request ID
    const incomingReqId = req.headers['x-request-id'];
    const requestId = incomingReqId || `req-${crypto_1.default.randomUUID()}`;
    req.requestId = requestId;
    req.startTime = Date.now();
    req.clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    // Set X-Request-ID on response headers for correlation
    res.setHeader('X-Request-ID', requestId);
    next();
}
exports.default = requestContextMiddleware;
