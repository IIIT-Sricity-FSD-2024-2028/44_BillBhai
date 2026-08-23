"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rbac_middleware_1 = require("../middleware/rbac.middleware");
const security_middleware_1 = require("../middleware/security.middleware");
const upload_middleware_1 = require("../middleware/upload.middleware");
const router = (0, express_1.Router)();
// Router-level middleware 1: Authenticate user
router.use(rbac_middleware_1.authenticateToken);
// Router-level middleware 2: Upload rate limiting
router.use(security_middleware_1.uploadRateLimiter);
/**
 * POST /api/upload/receipt
 * Upload a single receipt file (JPEG, PNG, WEBP, PDF - max 5MB)
 */
router.post('/receipt', upload_middleware_1.uploadReceipt, (req, res) => {
    const file = req.file;
    res.status(201).json({
        success: true,
        message: 'Receipt uploaded successfully',
        data: {
            filename: file.filename,
            originalName: file.originalname,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            path: `/uploads/${file.filename}`,
        },
    });
});
/**
 * POST /api/upload/bills
 * Upload multiple bill files (up to 5 files)
 */
router.post('/bills', upload_middleware_1.uploadMultipleBills, (req, res) => {
    const files = req.files.map((file) => ({
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        path: `/uploads/${file.filename}`,
    }));
    res.status(201).json({
        success: true,
        message: `${files.length} bill file(s) uploaded successfully`,
        data: files,
    });
});
exports.default = router;
