"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.corsSecurityMiddleware = void 0;
const cors_1 = __importDefault(require("cors"));
const config_1 = __importDefault(require("../config/config"));
const logger_1 = __importDefault(require("../utils/logger"));
exports.corsSecurityMiddleware = (0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin)
            return callback(null, true);
        if (config_1.default.corsOrigins.includes('*') || config_1.default.corsOrigins.includes(origin)) {
            return callback(null, true);
        }
        logger_1.default.warn(`CORS blocked request from origin: ${origin}`);
        return callback(new Error(`CORS policy blocked access from origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'x-user-role'],
});
exports.default = exports.corsSecurityMiddleware;
