import { Router, Request, Response } from 'express';
import { authRouter } from '../modules/auth/auth.routes';
import { companiesRouter } from '../modules/companies/companies.routes';
import { customersRouter } from '../modules/customers/customers.routes';
import { deliveriesRouter } from '../modules/deliveries/deliveries.routes';
import { exampleRouter } from '../modules/example/example.routes';
import { inventoryRouter } from '../modules/inventory/inventory.routes';
import { ordersRouter } from '../modules/orders/orders.routes';
import { productsRouter } from '../modules/products/products.routes';
import { paymentsRouter } from '../modules/payments/payments.routes';
import { reportsRouter } from '../modules/reports/reports.routes';
import { returnsRouter } from '../modules/returns/returns.routes';
import { suppliersRouter } from '../modules/suppliers/suppliers.routes';
import { uploadsRouter } from '../modules/uploads/uploads.routes';
import { usersRouter } from '../modules/users/users.routes';

/**
 * Central API Router
 *
 * Aggregates every feature module under the configured API prefix and exposes
 * the base API status endpoint.
 *
 * To add a module: build it under express/modules/<name>/ following
 * MIGRATION_RULES.md, then add one import above and one mount line below.
 * This is the only shared file a module migration is allowed to touch.
 */
export function createApiRouter(): Router {
  const apiRouter = Router();

  apiRouter.get('/', (_req: Request, res: Response) => {
    res.status(200).json({
      name: 'BillBhai API',
      description:
        'BillBhai Retail Order Processing and Billing System (Express runtime)',
      version: '1.0.0',
      status: 'operational',
      documentation: '/api/docs',
      authentication: {
        login: 'POST /api/auth/login',
        schemes: [
          'Authorization: Bearer <jwt>  (issued at login)',
          'x-role: <role>               (header used by the existing frontend)',
        ],
      },
      endpoints: {
        auth: '/api/auth',
        companies: '/api/companies',
        users: '/api/users',
        customers: '/api/customers',
        products: '/api/products',
        inventory: '/api/inventory',
        orders: '/api/orders',
        deliveries: '/api/deliveries',
        returns: '/api/returns',
        reports: '/api/reports',
        suppliers: '/api/suppliers',
        uploads: '/api/uploads',
        payments: '/api/payments',
        example: '/api/example',
      },
    });
  });

  // Feature module routers
  apiRouter.use('/auth', authRouter);
  apiRouter.use('/companies', companiesRouter);
  apiRouter.use('/users', usersRouter);
  apiRouter.use('/customers', customersRouter);
  apiRouter.use('/products', productsRouter);
  apiRouter.use('/inventory', inventoryRouter);
  apiRouter.use('/orders', ordersRouter);
  apiRouter.use('/deliveries', deliveriesRouter);
  apiRouter.use('/returns', returnsRouter);
  apiRouter.use('/reports', reportsRouter);
  apiRouter.use('/suppliers', suppliersRouter);
  apiRouter.use('/uploads', uploadsRouter);
  apiRouter.use('/payments', paymentsRouter);

  // Reference template module, kept for developers adding new modules.
  apiRouter.use('/example', exampleRouter);

  return apiRouter;
}

export const apiRouter = createApiRouter();
