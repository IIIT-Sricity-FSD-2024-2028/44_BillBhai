import { Router } from 'express';
import { requireRoles } from '../../middleware/rbac.middleware';
import {
  handleUploadError,
  uploadProductCsv,
  uploadProductImage,
} from '../../middleware/upload.middleware';
import { validate } from '../../middleware/validate.middleware';
import { uploadsController, UploadsController } from './uploads.controller';
import {
  attachImageParamsSchema,
  listUploadsQuerySchema,
  uploadIdParamsSchema,
} from './uploads.schema';

/**
 * Uploads Module Router
 *
 * Demonstrates the file upload middleware. The chain on an upload route is:
 *   requireRoles(...)    -> role based access control
 *   validate({ params }) -> zod validation of the URL parameters
 *   multer uploader      -> parses multipart/form-data, enforces size + MIME
 *   handleUploadError    -> converts multer errors into the standard envelope
 *   controller.method    -> request handling
 *
 * handleUploadError sits directly after the uploader because an error thrown
 * by multer must be caught before the controller runs.
 */
export function createUploadsRouter(
  controller: UploadsController = uploadsController,
): Router {
  const router = Router();

  router.post(
    '/image',
    requireRoles('superuser', 'admin', 'inventorymanager'),
    uploadProductImage,
    handleUploadError,
    controller.uploadImage,
  );

  router.post(
    '/products/csv',
    requireRoles('superuser', 'admin', 'inventorymanager'),
    uploadProductCsv,
    handleUploadError,
    controller.importCsv,
  );

  router.post(
    '/products/:id/image',
    requireRoles('superuser', 'admin', 'inventorymanager'),
    validate({ params: attachImageParamsSchema }),
    uploadProductImage,
    handleUploadError,
    controller.attachToProduct,
  );

  router.get(
    '/',
    requireRoles('superuser', 'admin'),
    validate({ query: listUploadsQuerySchema }),
    controller.findAll,
  );

  router.get(
    '/:id',
    requireRoles('superuser', 'admin'),
    validate({ params: uploadIdParamsSchema }),
    controller.findOne,
  );

  router.delete(
    '/:id',
    requireRoles('superuser', 'admin'),
    validate({ params: uploadIdParamsSchema }),
    controller.remove,
  );

  return router;
}

export const uploadsRouter = createUploadsRouter();
