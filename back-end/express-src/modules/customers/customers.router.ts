'use strict';
const express = require('express');
const { roles } = require('../../middleware/roles.middleware');

function createCustomersRouter(customersService) {
  const router = express.Router();

  router.get('/', roles('superuser', 'admin', 'cashier', 'returnhandler'), (req, res, next) => {
    try { res.json(customersService.findAll(req.query.companyId)); } catch (e) { next(e); }
  });
  router.get('/phone/:phone', roles('superuser', 'admin', 'cashier'), (req, res, next) => {
    try { res.json(customersService.findByPhone(req.params.phone, req.query.companyId)); } catch (e) { next(e); }
  });
  router.get('/:id', roles('superuser', 'admin', 'cashier'), (req, res, next) => {
    try { res.json(customersService.findOne(req.params.id)); } catch (e) { next(e); }
  });
  router.post('/', roles('superuser', 'admin', 'cashier', 'customer'), (req, res, next) => {
    try { res.status(201).json(customersService.create(req.body)); } catch (e) { next(e); }
  });
  router.put('/:id', roles('superuser', 'admin', 'cashier'), (req, res, next) => {
    try { res.json(customersService.update(req.params.id, req.body)); } catch (e) { next(e); }
  });
  router.delete('/:id', roles('superuser', 'admin'), (req, res, next) => {
    try { res.json(customersService.remove(req.params.id)); } catch (e) { next(e); }
  });

  return router;
}

module.exports = { createCustomersRouter };
