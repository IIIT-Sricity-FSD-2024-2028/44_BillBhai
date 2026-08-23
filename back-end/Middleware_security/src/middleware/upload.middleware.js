"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadMultipleBills = exports.uploadReceipt = exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
const config_1 = __importDefault(require("../config/config"));
const logger_1 = __importDefault(require("../utils/logger"));
const apiError_1 = require("../utils/apiError");
// Ensure upload directory exists
const uploadDir = path_1.default.join(process.cwd(), config_1.default.upload.uploadDir);
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
// Storage Configuration
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        const uniqueName = `bill-${Date.now()}-${crypto_1.default.randomBytes(4).toString('hex')}${ext}`;
        cb(null, uniqueName);
    },
});
// File Filter Function
const fileFilter = (req, file, cb) => {
    if (config_1.default.upload.allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        logger_1.default.warn(`File upload rejected due to invalid MIME type: ${file.mimetype} (${file.originalname})`, {
            requestId: req.requestId,
        });
        cb(new apiError_1.FileUploadError(`Invalid file type: ${file.mimetype}. Allowed types: ${config_1.default.upload.allowedMimeTypes.join(', ')}`));
    }
};
// Multer Instance
exports.upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: config_1.default.upload.maxFileSize, // 5MB limit
    },
    fileFilter,
});
/**
 * Middleware wrapper for single receipt upload
 */
const uploadReceipt = (req, res, next) => {
    const singleUpload = exports.upload.single('receipt');
    singleUpload(req, res, (err) => {
        if (err) {
            if (err instanceof multer_1.default.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return next(new apiError_1.FileUploadError(`File size exceeds maximum allowed limit of ${config_1.default.upload.maxFileSize / (1024 * 1024)}MB`));
                }
                return next(new apiError_1.FileUploadError(`Multer upload error: ${err.message}`));
            }
            return next(err);
        }
        if (!req.file) {
            return next(new apiError_1.FileUploadError('No file attached. Please upload a receipt file under key "receipt"'));
        }
        logger_1.default.info(`File successfully uploaded: ${req.file.filename} (${req.file.size} bytes)`, {
            requestId: req.requestId,
            filename: req.file.filename,
        });
        next();
    });
};
exports.uploadReceipt = uploadReceipt;
/**
 * Middleware wrapper for multiple bill files upload
 */
const uploadMultipleBills = (req, res, next) => {
    const multiUpload = exports.upload.array('bills', 5);
    multiUpload(req, res, (err) => {
        if (err) {
            if (err instanceof multer_1.default.MulterError) {
                if (err.code === 'LIMIT_FILE_SIZE') {
                    return next(new apiError_1.FileUploadError(`File size exceeds maximum allowed limit of ${config_1.default.upload.maxFileSize / (1024 * 1024)}MB`));
                }
                return next(new apiError_1.FileUploadError(`Multer upload error: ${err.message}`));
            }
            return next(err);
        }
        const files = req.files;
        if (!files || files.length === 0) {
            return next(new apiError_1.FileUploadError('No files attached. Please upload files under key "bills"'));
        }
        logger_1.default.info(`Multiple files successfully uploaded: ${files.length} files`, {
            requestId: req.requestId,
            filenames: files.map((f) => f.filename),
        });
        next();
    });
};
exports.uploadMultipleBills = uploadMultipleBills;
