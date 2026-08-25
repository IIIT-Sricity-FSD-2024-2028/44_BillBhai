import fs from 'fs';
import path from 'path';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import multer, { FileFilterCallback, MulterError } from 'multer';
import { config } from '../config/index';
import { BadRequestError } from '../errors/http-error';
import { logger } from '../utils/logger';

/**
 * File Upload Middleware (multer)
 *
 * Two configured uploaders:
 *   uploadProductImage - a single product photograph  -> uploads/images
 *   uploadProductCsv   - a bulk product import file   -> uploads/imports
 *
 * Both enforce a size ceiling and a MIME allowlist, and both write to disk
 * under a timestamped, sanitised filename so a hostile original name cannot
 * escape the upload directory.
 */

const uploadRoot = path.isAbsolute(config.uploads.dir)
  ? config.uploads.dir
  : path.resolve(process.cwd(), config.uploads.dir);

export const IMAGE_DIR = path.join(uploadRoot, 'images');
export const IMPORT_DIR = path.join(uploadRoot, 'imports');

[uploadRoot, IMAGE_DIR, IMPORT_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function sanitiseFilename(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase().slice(0, 10);
  const base = path
    .basename(originalName, path.extname(originalName))
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .slice(0, 40)
    .replace(/^-+|-+$/g, '');
  return `${Date.now()}-${base || 'file'}${ext}`;
}

function storageFor(destination: string): multer.StorageEngine {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, destination),
    filename: (_req, file, cb) => cb(null, sanitiseFilename(file.originalname)),
  });
}

function mimeFilter(allowed: string[]) {
  return (_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void => {
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(
      new BadRequestError(
        `Unsupported file type "${file.mimetype}". Allowed types: ${allowed.join(', ')}`,
      ),
    );
  };
}

export const uploadProductImage: RequestHandler = multer({
  storage: storageFor(IMAGE_DIR),
  limits: { fileSize: config.uploads.maxFileSizeBytes, files: 1 },
  fileFilter: mimeFilter(config.uploads.allowedImageTypes),
}).single('image');

export const uploadProductCsv: RequestHandler = multer({
  storage: storageFor(IMPORT_DIR),
  limits: { fileSize: config.uploads.maxFileSizeBytes, files: 1 },
  fileFilter: mimeFilter(config.uploads.allowedImportTypes),
}).single('file');

/**
 * Translates multer's own error type into the application's HttpError shape so
 * upload failures come back in exactly the same JSON envelope as every other
 * error in the API.
 */
export function handleUploadError(
  err: unknown,
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (err instanceof MulterError) {
    logger.warn('Upload rejected by multer', {
      requestId: req.requestId,
      code: err.code,
      field: err.field,
    });

    const messages: Record<string, string> = {
      LIMIT_FILE_SIZE: `File is larger than the ${Math.round(config.uploads.maxFileSizeBytes / 1024 / 1024)}MB limit`,
      LIMIT_FILE_COUNT: 'Only one file may be uploaded per request',
      LIMIT_UNEXPECTED_FILE: `Unexpected form field "${err.field}"`,
    };

    next(new BadRequestError(messages[err.code] || `Upload failed: ${err.message}`));
    return;
  }

  next(err);
}
