"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston_1 = require("winston");
const winston_daily_rotate_file_1 = __importDefault(require("winston-daily-rotate-file"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const config_1 = __importDefault(require("../config/config"));
// ── Custom levels & colours ────────────────────────────────────────────────────
const customLevels = {
    levels: {
        error: 0,
        warn: 1,
        info: 2,
        http: 3,
        verbose: 4,
        debug: 5,
    },
    colors: {
        error: 'red',
        warn: 'yellow',
        info: 'green',
        http: 'magenta',
        verbose: 'cyan',
        debug: 'white',
    },
};
(0, winston_1.addColors)(customLevels.colors);
// Ensure logs directory exists
const logsDir = path_1.default.join(process.cwd(), 'logs');
if (!fs_1.default.existsSync(logsDir)) {
    fs_1.default.mkdirSync(logsDir, { recursive: true });
}
// ── Formats ────────────────────────────────────────────────────────────────────
const timestampFmt = winston_1.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' });
const jsonFormat = winston_1.format.combine(timestampFmt, winston_1.format.errors({ stack: true }), winston_1.format.json());
const consoleFormat = winston_1.format.combine(timestampFmt, winston_1.format.colorize({ all: true }), winston_1.format.printf((info) => {
    const { timestamp, level, message, stack, requestId } = info;
    const reqTag = requestId ? ` [ReqID: ${requestId}]` : '';
    return stack
        ? `${timestamp} [${level}]${reqTag}: ${message}\n${stack}`
        : `${timestamp} [${level}]${reqTag}: ${message}`;
}));
// ── File Transports (Daily Rotation) ──────────────────────────────────────────
const appFileTransport = new winston_daily_rotate_file_1.default({
    dirname: logsDir,
    filename: 'app-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    level: 'info',
    format: jsonFormat,
});
const errorFileTransport = new winston_daily_rotate_file_1.default({
    dirname: logsDir,
    filename: 'error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '30d',
    level: 'error',
    format: jsonFormat,
});
const accessFileTransport = new winston_daily_rotate_file_1.default({
    dirname: logsDir,
    filename: 'access-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '7d',
    level: 'http',
    format: jsonFormat,
});
const consoleLevel = config_1.default.isDev ? 'debug' : 'http';
// ── Logger Instance ───────────────────────────────────────────────────────────
exports.logger = (0, winston_1.createLogger)({
    levels: customLevels.levels,
    level: 'debug',
    transports: [
        appFileTransport,
        errorFileTransport,
        accessFileTransport,
        new winston_1.transports.Console({
            format: consoleFormat,
            level: consoleLevel,
        }),
    ],
    exitOnError: false,
});
appFileTransport.on('rotate', (oldFile, newFile) => {
    exports.logger.info(`App log rotated: ${oldFile} -> ${newFile}`);
});
errorFileTransport.on('rotate', (oldFile, newFile) => {
    exports.logger.info(`Error log rotated: ${oldFile} -> ${newFile}`);
});
accessFileTransport.on('rotate', (oldFile, newFile) => {
    exports.logger.info(`Access log rotated: ${oldFile} -> ${newFile}`);
});
exports.default = exports.logger;
