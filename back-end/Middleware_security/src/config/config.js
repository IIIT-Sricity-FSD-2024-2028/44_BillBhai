"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.config = {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    isDev: (process.env.NODE_ENV || 'development') !== 'production',
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5500,http://127.0.0.1:5500')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    jwtSecret: process.env.JWT_SECRET || 'billbhai-secure-jwt-secret-key-2026',
    upload: {
        maxFileSize: 5 * 1024 * 1024, // 5MB
        allowedMimeTypes: [
            'image/jpeg',
            'image/png',
            'image/webp',
            'application/pdf'
        ],
        uploadDir: 'uploads'
    },
    throttle: {
        global: {
            windowMs: parseInt(process.env.THROTTLE_GLOBAL_TTL_MS || '60000', 10),
            limit: parseInt(process.env.THROTTLE_GLOBAL_LIMIT || '100', 10),
        },
        login: {
            windowMs: parseInt(process.env.THROTTLE_LOGIN_TTL_MS || '60000', 10),
            limit: parseInt(process.env.THROTTLE_LOGIN_LIMIT || '5', 10),
        },
        strict: {
            windowMs: parseInt(process.env.THROTTLE_STRICT_TTL_MS || '60000', 10),
            limit: parseInt(process.env.THROTTLE_STRICT_LIMIT || '20', 10),
        },
    },
};
exports.default = exports.config;
