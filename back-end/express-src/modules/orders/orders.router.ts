'use strict';
const express = require('express');
const { roles } = require('../../middleware/roles.middleware');

function createOrdersRouter(ordersService) {
  const router = express.Router();

  // Specific routes BEFORE generic /:id
  router.get('/bills/all',       roles('superuser','admin','cashier'), (req, res, next) => { try { res.json(ordersService.findAllBills()); } catch(e){next(e);} });
  router.post('/bills',          roles('superuser','admin','cashier'), (req, res, next) => { try { res.status(201).json(ordersService.createBill(req.body)); } catch(e){next(e);} });
  router.get('/bills/:billNo',   roles('superuser','admin','cashier'), (req, res, next) => { try { res.json(ordersService.findOneBill(req.params.billNo)); } catch(e){next(e);} });
  router.get('/payments/all',    roles('superuser','admin','cashier'), (req, res, next) => { try { res.json(ordersService.findAllPayments()); } catch(e){next(e);} });
  router.post('/payments',       roles('superuser','admin','cashier'), (req, res, next) => { try { res.status(201).json(ordersService.createPayment(req.body)); } catch(e){next(e);} });
  router.get('/payments/:billNo',roles('superuser','admin','cashier'), (req, res, next) => { try { res.json(ordersService.findOnePayment(req.params.billNo)); } catch(e){next(e);} });
  router.post('/promotions/validate', roles('superuser','admin','cashier','customer'), (req, res, next) => {
    try { res.json(ordersService.validatePromotion(req.body.code, req.body.subtotal)); } catch(e){next(e);}
  });

  // Generic order routes
  router.get('/',    roles('superuser','admin','cashier','returnhandler'), (req, res, next) => { try { res.json(ordersService.findAllOrders(req.query.companyId)); } catch(e){next(e);} });
  router.post('/',   roles('superuser','admin','cashier','customer'), async (req, res, next) => { try { res.status(201).json(ordersService.createOrder(req.body)); } catch(e){next(e);} });
  router.get('/:id', roles('superuser','admin','cashier','returnhandler','deliveryops'), (req, res, next) => { try { res.json(ordersService.findOneOrder(req.params.id)); } catch(e){next(e);} });
  router.put('/:id', roles('superuser','admin','cashier'), (req, res, next) => { try { res.json(ordersService.updateOrder(req.params.id, req.body)); } catch(e){next(e);} });
  router.delete('/:id', roles('superuser','admin'), (req, res, next) => { try { res.json(ordersService.removeOrder(req.params.id)); } catch(e){next(e);} });

  return router;
}

module.exports = { createOrdersRouter };
