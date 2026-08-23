'use strict';
const express = require('express');
const path    = require('path');
const { roles } = require('../../middleware/roles.middleware');
const { uploadImage, handleUploadError } = require('../../middleware/file-upload.middleware');

function createProductsRouter(productsService) {
  const router = express.Router();

  router.get('/', roles('superuser', 'admin', 'cashier', 'inventorymanager', 'returnhandler', 'deliveryops'), (req, res, next) => {
    try { res.json(productsService.findAll(req.query.category)); } catch (e) { next(e); }
  });
  router.get('/categories', roles('superuser', 'admin', 'cashier', 'inventorymanager'), (req, res, next) => {
    try { res.json(productsService.getCategories()); } catch (e) { next(e); }
  });
  router.get('/barcode/:barcode', roles('superuser', 'admin', 'cashier', 'inventorymanager'), (req, res, next) => {
    try { res.json(productsService.findByBarcode(req.params.barcode)); } catch (e) { next(e); }
  });
  router.get('/:id', roles('superuser', 'admin', 'cashier', 'inventorymanager'), (req, res, next) => {
    try { res.json(productsService.findOne(req.params.id)); } catch (e) { next(e); }
  });
  router.post('/', roles('superuser', 'admin', 'inventorymanager'), (req, res, next) => {
    try { res.status(201).json(productsService.create(req.body)); } catch (e) { next(e); }
  });
  router.put('/:id', roles('superuser', 'admin', 'inventorymanager'), (req, res, next) => {
    try { res.json(productsService.update(req.params.id, req.body)); } catch (e) { next(e); }
  });
  router.delete('/:id', roles('superuser', 'admin', 'inventorymanager'), (req, res, next) => {
    try { res.json(productsService.remove(req.params.id)); } catch (e) { next(e); }
  });

  /**
   * POST /api/products/:id/image
   * Upload a product image (JPG / PNG / WEBP, max 5 MB).
   * Demonstrates file-upload middleware in a real route.
   *
   * Form field : "image"  (multipart/form-data)
   * Access     : admin, inventorymanager, superuser
   *
   * Pipeline:
   *   roles() → uploadImage.single() → handleUploadError → handler
   */
  router.post(
    '/:id/image',
    roles('superuser', 'admin', 'inventorymanager'),
    uploadImage.single('image'),
    handleUploadError,
    (req, res, next) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            statusCode: 400,
            timestamp:  new Date().toISOString(),
            path:       req.originalUrl,
            requestId:  req.requestId || null,
            message:    'No image file provided. Send a JPG / PNG / WEBP under the "image" field.',
            error:      'Bad Request',
          });
        }

        // Confirm the target product exists (throws AppError if not found)
        const product = productsService.findOne(req.params.id);

        const imageUrl = `/uploads/images/${path.basename(req.file.path)}`;

        return res.status(200).json({
          statusCode: 200,
          message:    'Product image uploaded successfully.',
          productId:  product.id,
          imageUrl,
          file: {
            originalName: req.file.originalname,
            storedAs:     req.file.filename,
            size:         req.file.size,
            mimetype:     req.file.mimetype,
          },
        });
      } catch (e) { next(e); }
    },
  );

  return router;
}

module.exports = { createProductsRouter };

