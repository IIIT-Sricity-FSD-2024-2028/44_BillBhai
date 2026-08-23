'use strict';
const express = require('express');
const { roles } = require('../../middleware/roles.middleware');

function createUsersRouter(usersService) {
  const router = express.Router();

  // GET /api/users?companyId=BIZ-101
  router.get('/', roles('superuser', 'admin'), (req, res, next) => {
    try { res.json(usersService.findAll(req.query.companyId)); } catch (e) { next(e); }
  });

  // GET /api/users/:id
  router.get('/:id', roles('superuser', 'admin'), (req, res, next) => {
    try { res.json(usersService.findOne(req.params.id)); } catch (e) { next(e); }
  });

  // POST /api/users
  router.post('/', roles('superuser', 'admin'), async (req, res, next) => {
    try { res.status(201).json(await usersService.create(req.body)); } catch (e) { next(e); }
  });

  // PUT /api/users/:id
  router.put('/:id', roles('superuser', 'admin'), async (req, res, next) => {
    try { res.json(await usersService.update(req.params.id, req.body)); } catch (e) { next(e); }
  });

  // DELETE /api/users/:id
  router.delete('/:id', roles('superuser', 'admin'), (req, res, next) => {
    try { res.json(usersService.remove(req.params.id)); } catch (e) { next(e); }
  });

  return router;
}

module.exports = { createUsersRouter };
