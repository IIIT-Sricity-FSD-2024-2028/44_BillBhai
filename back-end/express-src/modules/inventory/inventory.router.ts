'use strict';
const express = require('express');
const path    = require('path');
const { roles } = require('../../middleware/roles.middleware');
const { uploadCsv, handleUploadError } = require('../../middleware/file-upload.middleware');

function createInventoryRouter(inventoryService) {
  const router = express.Router();

  // ── Router-level middleware ───────────────────────────────────────────────────
  // Applied to EVERY route in this router automatically.
  // This is router-level middleware (vs application-level middleware in server.js).
  // Only superuser, admin, or inventorymanager may access any /api/inventory/* route.
  router.use(roles('superuser', 'admin', 'inventorymanager', 'cashier'));

  // ── Routes ────────────────────────────────────────────────────────────────────
  router.get('/', (req, res, next) => {
    try { res.json(inventoryService.findAll()); } catch (e) { next(e); }
  });

  // IMPORTANT: specific routes BEFORE /:id
  router.get('/low-stock', (req, res, next) => {
    try { res.json(inventoryService.findLowStock()); } catch (e) { next(e); }
  });

  router.get('/product/:productId', (req, res, next) => {
    try { res.json(inventoryService.findByProduct(req.params.productId)); } catch (e) { next(e); }
  });

  router.get('/:id', (req, res, next) => {
    try { res.json(inventoryService.findOne(req.params.id)); } catch (e) { next(e); }
  });

  router.put('/:id', (req, res, next) => {
    try { res.json(inventoryService.update(req.params.id, req.body)); } catch (e) { next(e); }
  });

  router.post('/adjust', (req, res, next) => {
    try { res.json(inventoryService.adjustStock(req.body)); } catch (e) { next(e); }
  });

  router.delete('/:id', (req, res, next) => {
    try { res.json(inventoryService.remove(req.params.id)); } catch (e) { next(e); }
  });

  /**
   * POST /api/inventory/import
   * Bulk-import inventory records via CSV upload (max 2 MB).
   * Demonstrates CSV file-upload middleware in a router-level-guarded route.
   *
   * Form field : "file"  (multipart/form-data, text/csv)
   * Access     : guarded by router.use(roles(...)) above
   */
  router.post(
    '/import',
    uploadCsv.single('file'),
    handleUploadError,
    (req, res, next) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            statusCode: 400,
            timestamp:  new Date().toISOString(),
            path:       req.originalUrl,
            requestId:  req.requestId || null,
            message:    'No CSV file provided. Send a .csv file under the "file" field.',
            error:      'Bad Request',
          });
        }

        return res.status(200).json({
          statusCode: 200,
          message:    'Inventory CSV file uploaded successfully. Processing will begin shortly.',
          file: {
            originalName: req.file.originalname,
            storedAs:     req.file.filename,
            path:         `/uploads/imports/${path.basename(req.file.path)}`,
            size:         req.file.size,
            mimetype:     req.file.mimetype,
          },
        });
      } catch (e) { next(e); }
    },
  );

  return router;
}

module.exports = { createInventoryRouter };

