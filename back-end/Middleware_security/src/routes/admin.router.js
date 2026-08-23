"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const rbac_middleware_1 = require("../middleware/rbac.middleware");
const logger_1 = __importDefault(require("../utils/logger"));
const router = (0, express_1.Router)();
// Router-level middleware 1: Authenticate user
router.use(rbac_middleware_1.authenticateToken);
// Router-level middleware 2: Strict RBAC check - ADMIN only!
router.use((0, rbac_middleware_1.authorizeRoles)('ADMIN'));
// Router-level middleware 3: Audit log admin actions
router.use((req, res, next) => {
    logger_1.default.info(`ADMIN ACTION: User ${req.user?.id} (${req.user?.email}) accessed admin route ${req.originalUrl}`, {
        requestId: req.requestId,
        adminId: req.user?.id,
    });
    next();
});
/**
 * GET /api/admin/system-status
 * Retrieve system status and active configuration
 */
router.get('/system-status', (req, res) => {
    res.json({
        success: true,
        data: {
            status: 'OPERATIONAL',
            uptimeSeconds: process.uptime(),
            memoryUsage: process.memoryUsage(),
            timestamp: new Date().toISOString(),
        },
    });
});
/**
 * GET /api/admin/logs
 * List generated log files stored at regular intervals in logs/
 */
router.get('/logs', (req, res) => {
    const logsDir = path_1.default.join(process.cwd(), 'logs');
    let files = [];
    if (fs_1.default.existsSync(logsDir)) {
        files = fs_1.default.readdirSync(logsDir);
    }
    res.json({
        success: true,
        logsDirectory: logsDir,
        logFileCount: files.length,
        logFiles: files.map((file) => {
            const stats = fs_1.default.statSync(path_1.default.join(logsDir, file));
            return {
                filename: file,
                sizeBytes: stats.size,
                lastModified: stats.mtime,
            };
        }),
    });
});
exports.default = router;
