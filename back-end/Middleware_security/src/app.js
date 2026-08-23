"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = exports.createApp = void 0;
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const middleware_1 = require("./middleware");
const auth_router_1 = __importDefault(require("./routes/auth.router"));
const bill_router_1 = __importDefault(require("./routes/bill.router"));
const upload_router_1 = __importDefault(require("./routes/upload.router"));
const admin_router_1 = __importDefault(require("./routes/admin.router"));
const createApp = () => {
    const app = (0, express_1.default)();
    // ── 1. Mandatory Request Context & Correlation ID Middleware ──────────────────
    app.use(middleware_1.requestContextMiddleware);
    // ── 2. Mandatory Security Middleware (Helmet, CORS, Rate Limiting) ───────────
    app.use(middleware_1.helmetSecurityMiddleware);
    app.use(middleware_1.corsSecurityMiddleware);
    app.use(middleware_1.globalRateLimiter);
    // ── 3. Mandatory Logging Middleware (Winston file rotation logging) ─────────
    app.use(middleware_1.requestLoggerMiddleware);
    // Body Parsers
    app.use(express_1.default.json({ limit: '10mb' }));
    app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
    // Static uploads directory
    const uploadsDir = path_1.default.join(process.cwd(), 'uploads');
    app.use('/uploads', express_1.default.static(uploadsDir));
    // Health check endpoint
    app.get('/health', (req, res) => {
        res.json({
            status: 'UP',
            requestId: req.requestId,
            timestamp: new Date().toISOString(),
        });
    });
    // ── 4. Mandatory Router-level Middleware Mounting ────────────────────────────
    app.use('/api/auth', auth_router_1.default);
    app.use('/api/bills', bill_router_1.default);
    app.use('/api/upload', upload_router_1.default);
    app.use('/api/admin', admin_router_1.default);
    // ── 5. Mandatory Error Handling Middleware ────────────────────────────────────
    app.use(middleware_1.notFoundHandler);
    app.use(middleware_1.globalErrorHandler);
    return app;
};
exports.createApp = createApp;
exports.app = (0, exports.createApp)();
exports.default = exports.app;
