'use strict';

/**
 * file-upload.middleware.js — BillBhai File Upload Middleware
 *
 * Provides ready-to-use multer upload instances for different use-cases:
 *
 *   uploadImage   — single image  (jpg / jpeg / png / webp)  ≤ 5 MB
 *                   field name: "image"
 *                   stored at: uploads/images/<timestamp>-<original>
 *
 *   uploadCsv     — single CSV / Excel file                   ≤ 2 MB
 *                   field name: "file"
 *                   stored at: uploads/imports/<timestamp>-<original>
 *
 *   handleUploadError — Express error-handling middleware
 *                       converts multer-specific errors (file size, type)
 *                       into standard 400 responses instead of 500s.
 *
 * Usage in a router:
 *   const { uploadImage, handleUploadError } = require('../../middleware/file-upload.middleware');
 *   router.post('/:id/image', uploadImage.single('image'), handleUploadError, handler);
 */

const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// ── Ensure upload directories exist ───────────────────────────────────────────
const ROOT_UPLOADS  = path.join(__dirname, '..', 'uploads');
const IMAGE_DIR     = path.join(ROOT_UPLOADS, 'images');
const IMPORT_DIR    = path.join(ROOT_UPLOADS, 'imports');

[ROOT_UPLOADS, IMAGE_DIR, IMPORT_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ── Storage engines ───────────────────────────────────────────────────────────
const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, IMAGE_DIR),
  filename:    (_req,  file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/\s+/g, '-');
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const csvStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, IMPORT_DIR),
  filename:    (_req,  file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/\s+/g, '-');
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

// ── File type filters ─────────────────────────────────────────────────────────
const imageFilter = (_req, file, cb) => {
  const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (ALLOWED.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE',
      `Only JPG, PNG, and WEBP images are allowed. Got: ${file.mimetype}`));
  }
};

const csvFilter = (_req, file, cb) => {
  const ALLOWED = ['text/csv', 'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
  if (ALLOWED.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE',
      `Only CSV or Excel files are allowed. Got: ${file.mimetype}`));
  }
};

// ── Multer instances ──────────────────────────────────────────────────────────
/**
 * uploadImage — use for product / company logo uploads.
 * Field name expected: "image"
 */
const uploadImage = multer({
  storage:  imageStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },  // 5 MB
});

/**
 * uploadCsv — use for bulk import (inventory, products, customers).
 * Field name expected: "file"
 */
const uploadCsv = multer({
  storage:  csvStorage,
  fileFilter: csvFilter,
  limits: { fileSize: 2 * 1024 * 1024 },  // 2 MB
});

// ── Error handler (router/app level, 4-arg) ───────────────────────────────────
/**
 * handleUploadError
 * Place this immediately AFTER the multer middleware in the route chain.
 * Converts multer errors → 400 JSON responses so the global errorHandler
 * does not treat them as 500s.
 *
 *   router.post('/:id/image',
 *     uploadImage.single('image'),
 *     handleUploadError,     ← catches multer errors
 *     yourController
 *   );
 */
// eslint-disable-next-line no-unused-vars
function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError || err?.name === 'MulterError') {
    let message;
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File is too large. Maximum allowed size is 5 MB for images and 2 MB for CSV.';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = err.message || 'Unexpected file field or unsupported file type.';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files uploaded at once. Please upload one file at a time.';
        break;
      default:
        message = `File upload error: ${err.message}`;
    }
    return res.status(400).json({
      statusCode: 400,
      timestamp:  new Date().toISOString(),
      path:       req.originalUrl,
      requestId:  req.requestId || null,
      message,
      error: 'Bad Request',
    });
  }
  // Not a multer error — pass to global error handler
  next(err);
}

module.exports = { uploadImage, uploadCsv, handleUploadError };
