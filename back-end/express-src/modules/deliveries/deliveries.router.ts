'use strict';
const express = require('express');
const { roles } = require('../../middleware/roles.middleware');

function createDeliveriesRouter(deliveriesService) {
  const router = express.Router();

  router.get('/', roles('superuser','admin','deliveryops'), (req, res, next) => {
    try { res.json(deliveriesService.findAll(req.query.status)); } catch(e){next(e);}
  });
  router.get('/order/:orderId', roles('superuser','admin','deliveryops','cashier'), (req, res, next) => {
    try { res.json(deliveriesService.findByOrder(req.params.orderId)); } catch(e){next(e);}
  });
  router.get('/:id', roles('superuser','admin','deliveryops'), (req, res, next) => {
    try { res.json(deliveriesService.findOne(req.params.id)); } catch(e){next(e);}
  });
  router.post('/', roles('superuser','admin','deliveryops'), (req, res, next) => {
    try { res.status(201).json(deliveriesService.create(req.body)); } catch(e){next(e);}
  });
  router.put('/:id', roles('superuser','admin','deliveryops'), (req, res, next) => {
    try { res.json(deliveriesService.update(req.params.id, req.body)); } catch(e){next(e);}
  });
  router.delete('/:id', roles('superuser','admin'), (req, res, next) => {
    try { res.json(deliveriesService.remove(req.params.id)); } catch(e){next(e);}
  });

  return router;
}

module.exports = { createDeliveriesRouter };
