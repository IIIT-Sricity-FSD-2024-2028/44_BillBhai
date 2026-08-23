'use strict';
const express = require('express');
const { roles } = require('../../middleware/roles.middleware');

function createSuppliersRouter(suppliersService) {
  const router = express.Router();

  router.get('/', roles('superuser','admin','inventorymanager'), (req, res, next) => {
    try { res.json(suppliersService.findAll()); } catch(e){next(e);}
  });
  router.get('/:id', roles('superuser','admin','inventorymanager'), (req, res, next) => {
    try { res.json(suppliersService.findOne(req.params.id)); } catch(e){next(e);}
  });
  router.post('/', roles('superuser','admin','inventorymanager'), (req, res, next) => {
    try { res.status(201).json(suppliersService.create(req.body)); } catch(e){next(e);}
  });
  router.put('/:id', roles('superuser','admin','inventorymanager'), (req, res, next) => {
    try { res.json(suppliersService.update(req.params.id, req.body)); } catch(e){next(e);}
  });
  router.delete('/:id', roles('superuser','admin'), (req, res, next) => {
    try { res.json(suppliersService.remove(req.params.id)); } catch(e){next(e);}
  });

  return router;
}

module.exports = { createSuppliersRouter };
