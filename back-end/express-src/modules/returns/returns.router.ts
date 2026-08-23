'use strict';
const express = require('express');
const { roles } = require('../../middleware/roles.middleware');

function createReturnsRouter(returnsService) {
  const router = express.Router();

  router.get('/', roles('superuser','admin','returnhandler'), (req, res, next) => {
    try { res.json(returnsService.findAll(req.query.status)); } catch(e){next(e);}
  });
  router.get('/:id', roles('superuser','admin','returnhandler'), (req, res, next) => {
    try { res.json(returnsService.findOne(req.params.id)); } catch(e){next(e);}
  });
  router.post('/', roles('superuser','admin','returnhandler'), (req, res, next) => {
    try { res.status(201).json(returnsService.create(req.body)); } catch(e){next(e);}
  });
  router.put('/:id', roles('superuser','admin','returnhandler'), (req, res, next) => {
    try { res.json(returnsService.update(req.params.id, req.body)); } catch(e){next(e);}
  });
  router.delete('/:id', roles('superuser','admin'), (req, res, next) => {
    try { res.json(returnsService.remove(req.params.id)); } catch(e){next(e);}
  });

  return router;
}

module.exports = { createReturnsRouter };
