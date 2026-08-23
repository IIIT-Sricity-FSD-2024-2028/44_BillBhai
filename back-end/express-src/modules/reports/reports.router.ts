'use strict';
const express = require('express');
const { roles } = require('../../middleware/roles.middleware');

function createReportsRouter(reportsService) {
  const router = express.Router();

  router.get('/sales', roles('superuser','admin'), (req, res, next) => {
    try { res.json(reportsService.getSalesReport()); } catch(e){next(e);}
  });
  router.get('/inventory', roles('superuser','admin','inventorymanager'), (req, res, next) => {
    try { res.json(reportsService.getInventoryReport()); } catch(e){next(e);}
  });
  router.get('/returns', roles('superuser','admin','returnhandler'), (req, res, next) => {
    try { res.json(reportsService.getReturnsReport()); } catch(e){next(e);}
  });

  return router;
}

module.exports = { createReportsRouter };
