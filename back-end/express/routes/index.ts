import { Router, Request, Response } from 'express';
import { exampleRouter } from '../modules/example/example.routes';
import { productsRouter } from '../modules/products/products.routes';

/**
 * Central API Router
 *
 * Responsibilities:
 * - Aggregates and mounts all feature module routers under the configured API prefix (e.g. /api).
 * - Exposes the base API status/metadata endpoint.
 *
 * Migration Note for Future Modules:
 * When migrating a new module (e.g., products, orders, auth):
 * 1. Create the module in `express/modules/<name>/`
 * 2. Export its router from `<name>.routes.ts`
 * 3. Mount it here: `apiRouter.use('/<name>', <name>Router);`
 */
export function createApiRouter(): Router {
  const apiRouter = Router();

  // Base API health / info endpoint (GET /api)
  apiRouter.get('/', (req: Request, res: Response) => {
    res.status(200).json({
      name: 'BillBhai API',
      description:
        'The BillBhai Retail Order Processing System API (Express Runtime)',
      version: '1.0.0',
      status: 'operational',
      endpoints: {
        example: '/api/example',
        products: '/api/products',
        // Future migrated module endpoints will be listed here
      },
    });
  });

  // Feature Module Routers
  apiRouter.use('/example', exampleRouter);
  apiRouter.use('/products', productsRouter);

  // --- Future Module Mount Points (To be enabled in P4) ---
  // apiRouter.use('/auth', authRouter);
  // apiRouter.use('/companies', companiesRouter);
  // apiRouter.use('/users', usersRouter);
  // apiRouter.use('/customers', customersRouter);
  // apiRouter.use('/products', productsRouter);
  // apiRouter.use('/inventory', inventoryRouter);
  // apiRouter.use('/orders', ordersRouter);
  // apiRouter.use('/deliveries', deliveriesRouter);
  // apiRouter.use('/returns', returnsRouter);
  // apiRouter.use('/reports', reportsRouter);
  // apiRouter.use('/suppliers', suppliersRouter);

  return apiRouter;
}

export const apiRouter = createApiRouter();
