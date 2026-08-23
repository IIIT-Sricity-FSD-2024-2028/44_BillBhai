"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const config_1 = __importDefault(require("./config/config"));
const logger_1 = __importDefault(require("./utils/logger"));
const server = app_1.default.listen(config_1.default.port, () => {
    logger_1.default.info(`=======================================================`);
    logger_1.default.info(`🚀 BillBhai Middleware & Security Server Running`);
    logger_1.default.info(`📡 Port: ${config_1.default.port}`);
    logger_1.default.info(`🌍 Environment: ${config_1.default.nodeEnv}`);
    logger_1.default.info(`🛡️ Security: CORS, Helmet, Rate Limiter Active`);
    logger_1.default.info(`📝 Logging: Winston Daily Rotating Log Files Active`);
    logger_1.default.info(`=======================================================`);
});
// Process Unhandled Rejections & Exceptions Logging
process.on('unhandledRejection', (reason) => {
    logger_1.default.error(`Unhandled Rejection detected: ${reason?.message || reason}`, {
        stack: reason?.stack,
    });
});
process.on('uncaughtException', (error) => {
    logger_1.default.error(`Uncaught Exception detected: ${error.message}`, {
        stack: error.stack,
    });
    // Gracefully close server before exit
    server.close(() => {
        process.exit(1);
    });
});
exports.default = server;
