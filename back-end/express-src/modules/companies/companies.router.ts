'use strict';
const express = require('express');
const { roles } = require('../../middleware/roles.middleware');

function createCompaniesRouter(companiesService) {
  const router = express.Router();

  router.get('/', roles('superuser'), (req, res, next) => {
    try { res.json(companiesService.findAll()); } catch (e) { next(e); }
  });
  router.get('/:id', roles('superuser', 'admin'), (req, res, next) => {
    try { res.json(companiesService.findOne(req.params.id)); } catch (e) { next(e); }
  });
  router.post('/', roles('superuser'), (req, res, next) => {
    try { res.status(201).json(companiesService.create(req.body)); } catch (e) { next(e); }
  });
  router.put('/:id', roles('superuser'), (req, res, next) => {
    try { res.json(companiesService.update(req.params.id, req.body)); } catch (e) { next(e); }
  });
  router.delete('/:id', roles('superuser'), (req, res, next) => {
    try { res.json(companiesService.remove(req.params.id)); } catch (e) { next(e); }
  });

  return router;
}

module.exports = { createCompaniesRouter };
