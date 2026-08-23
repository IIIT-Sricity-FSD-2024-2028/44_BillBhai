import { Router } from 'express';
import { ExampleController, exampleController } from './example.controller';

/**
 * Example Module Routes
 *
 * Responsibilities:
 * - Defines HTTP method & path bindings for this module.
 * - Attaches module-specific / route-specific middleware (auth, RBAC, validation).
 * - Maps routes to controller action methods.
 *
 * NOTE: Router does NOT contain request/response parsing logic or business logic.
 */
export function createExampleRouter(
  controller: ExampleController = exampleController,
): Router {
  const router = Router();

  // GET /api/example - List all items
  router.get('/', controller.getAll);

  // GET /api/example/:id - Get item by ID
  router.get('/:id', controller.getById);

  // POST /api/example - Create new item
  router.post('/', controller.create);

  // PUT /api/example/:id - Update item by ID
  router.put('/:id', controller.update);

  // DELETE /api/example/:id - Delete item by ID
  router.delete('/:id', controller.remove);

  return router;
}

export const exampleRouter = createExampleRouter();
