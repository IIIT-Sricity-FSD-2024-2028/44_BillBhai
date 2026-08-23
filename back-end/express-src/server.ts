'use strict';

/**
 * server.js — BillBhai Express.js Backend Entry Point
 *
 * Middleware execution order (top → bottom):
 *  1. helmetMiddleware       — HTTP security headers
 *  2. corsConfig             — Origin allowlist (replaces origin:'*')
 *  3. Body parser            — JSON limit 50kb
 *  4. apiRateLimiter         — 100 req/min on /api/*
 *  5. requestContextMiddleware — stamps requestId, userRole, receivedAt
 *  6. requestLoggerMiddleware  — logs method, url, status, duration (→ file)
 *  7. Static /uploads          — serves uploaded images & CSV files
 *  8. Routes
 *  9. notFoundHandler        — 404 for unmatched routes
 * 10. errorHandler           — formats all errors consistently (→ file)
 */

const express = require('express');
const path    = require('path');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi    = require('swagger-ui-express');

const config = require('./config');
const logger = require('./logger');


// ── Security ──────────────────────────────────────────────────────────────────
const { helmetMiddleware, swaggerCspOverride } = require('./security/helmet');
const { corsConfig } = require('./security/cors');
const { apiRateLimiter } = require('./security/rate-limit');

// ── Middleware ────────────────────────────────────────────────────────────────
const { requestContextMiddleware } = require('./middleware/request-context.middleware');
const { requestLoggerMiddleware }  = require('./middleware/request-logger.middleware');
const { notFoundHandler }          = require('./middleware/not-found.middleware');
const { errorHandler }             = require('./middleware/error-handler.middleware');

// ── Services (instantiated once — manual DI container) ───────────────────────
const { UsersService }      = require('./modules/users/users.service');
const { AuthService }       = require('./modules/auth/auth.service');
const { CompaniesService }  = require('./modules/companies/companies.service');
const { CustomersService }  = require('./modules/customers/customers.service');
const { ProductsService }   = require('./modules/products/products.service');
const { InventoryService }  = require('./modules/inventory/inventory.service');
const { OrdersService }     = require('./modules/orders/orders.service');
const { DeliveriesService } = require('./modules/deliveries/deliveries.service');
const { ReturnsService }    = require('./modules/returns/returns.service');
const { ReportsService }    = require('./modules/reports/reports.service');
const { SuppliersService }  = require('./modules/suppliers/suppliers.service');

const usersService      = new UsersService();
const authService       = new AuthService(usersService);
const companiesService  = new CompaniesService();
const customersService  = new CustomersService();
const productsService   = new ProductsService();
const inventoryService  = new InventoryService();
const ordersService     = new OrdersService();
const deliveriesService = new DeliveriesService();
const returnsService    = new ReturnsService();
const reportsService    = new ReportsService(ordersService, inventoryService, returnsService);
const suppliersService  = new SuppliersService();

// ── Routers ───────────────────────────────────────────────────────────────────
const { createAuthRouter }       = require('./modules/auth/auth.router');
const { createUsersRouter }      = require('./modules/users/users.router');
const { createCompaniesRouter }  = require('./modules/companies/companies.router');
const { createCustomersRouter }  = require('./modules/customers/customers.router');
const { createProductsRouter }   = require('./modules/products/products.router');
const { createInventoryRouter }  = require('./modules/inventory/inventory.router');
const { createOrdersRouter }     = require('./modules/orders/orders.router');
const { createDeliveriesRouter } = require('./modules/deliveries/deliveries.router');
const { createReturnsRouter }    = require('./modules/returns/returns.router');
const { createReportsRouter }    = require('./modules/reports/reports.router');
const { createSuppliersRouter }  = require('./modules/suppliers/suppliers.router');

// ── Create App ────────────────────────────────────────────────────────────────
const app = express();

// ── 1. Security Headers ───────────────────────────────────────────────────────
app.use(helmetMiddleware);

// ── 2. CORS ───────────────────────────────────────────────────────────────────
app.use(corsConfig);

// ── 3. Body Parser with size limit ────────────────────────────────────────────
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

// ── 4. Global Rate Limit ──────────────────────────────────────────────────────
app.use('/api', apiRateLimiter);

// ── 5 & 6. Request Context + Logger ──────────────────────────────────────────
app.use(requestContextMiddleware);
app.use(requestLoggerMiddleware);

// ── 7. Static file serving — uploaded assets ─────────────────────────────────
// Serves /uploads/images/* and /uploads/imports/* created by multer.
// e.g. GET /uploads/images/1700000000000-product.png
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── 8. Root redirect ──────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.redirect(301, '/api');
});


// ── 8. Swagger UI (development only or when SWAGGER_ENABLED=true) ─────────────
if (config.swaggerEnabled) {
  app.use('/api', swaggerCspOverride);

  const swaggerSpec = swaggerJsdoc({
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'BillBhai API',
        version: '1.0.0',
        description: 'BillBhai Retail Order Processing System — Express.js Backend',
      },
      components: {
        securitySchemes: {
          'x-role': { type: 'apiKey', in: 'header', name: 'x-role' },
        },
      },
      security: [{ 'x-role': [] }],
      servers: [{ url: `http://localhost:${config.port}/api` }],
    },
    apis: ['./modules/**/*.router.js'],
  });

  app.use('/api', swaggerUi.serve);
  app.get('/api', swaggerUi.setup(swaggerSpec, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'BillBhai API Docs',
  }));
}

// ── 9. API Routes ─────────────────────────────────────────────────────────────
app.use('/api/auth',       createAuthRouter(authService));
app.use('/api/users',      createUsersRouter(usersService));
app.use('/api/companies',  createCompaniesRouter(companiesService));
app.use('/api/customers',  createCustomersRouter(customersService));
app.use('/api/products',   createProductsRouter(productsService));
app.use('/api/inventory',  createInventoryRouter(inventoryService));
app.use('/api/orders',     createOrdersRouter(ordersService));
app.use('/api/deliveries', createDeliveriesRouter(deliveriesService));
app.use('/api/returns',    createReturnsRouter(returnsService));
app.use('/api/reports',    createReportsRouter(reportsService));
app.use('/api/suppliers',  createSuppliersRouter(suppliersService));

// ── 10. 404 + Global Error Handler (MUST be last) ─────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── 11. Start Server ──────────────────────────────────────────────────────────
app.listen(config.port, () => {
  const lines = [
    '----------------------------------------------------',
    `BillBhai Express Backend : http://localhost:${config.port}`,
    `API prefix               : http://localhost:${config.port}/api`,
    `Uploads served at        : http://localhost:${config.port}/uploads`,
    ...(config.swaggerEnabled ? [`Swagger Docs             : http://localhost:${config.port}/api`] : []),
    `NODE_ENV                 : ${config.nodeEnv}`,
    `Allowed CORS origins     : ${config.corsOrigins.join(', ')}`,
    '----------------------------------------------------',
  ];
  lines.forEach((line) => logger.info(line));
});
