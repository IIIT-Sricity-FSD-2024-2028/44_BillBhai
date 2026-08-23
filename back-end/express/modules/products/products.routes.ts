import { NextFunction, Request, RequestHandler, Router, Response } from 'express';
import { ZodError, ZodTypeAny } from 'zod';
import { validate } from '../../../src/middleware/validate.middleware';
import { BadRequestError, ForbiddenError } from '../../../src/errors/http-error';
import { productsController, ProductsController } from './products.controller';
import {
  createProductSchema,
  listProductsQuerySchema,
  productBarcodeParamsSchema,
  productIdParamsSchema,
  updateProductSchema,
} from './products.schema';

function validateQuery(schema: ZodTypeAny): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedMessages = error.issues
          .map((issue) => `${issue.path.join('.') || 'query'}: ${issue.message}`)
          .join('; ');
        next(
          new BadRequestError(
            `Validation failed: ${formattedMessages}`,
            error.issues,
          ),
        );
        return;
      }
      next(error);
    }
  };
}

function requireRoles(...allowedRoles: string[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const headerValue = req.headers['x-role'];
    const rawHeaderRole = Array.isArray(headerValue)
      ? headerValue[0]
      : headerValue;

    if (!rawHeaderRole) {
      next(
        new ForbiddenError(
          'Missing "x-role" header. Please provide your role (e.g., admin, cashier) in the request headers.',
        ),
      );
      return;
    }

    const userRole = String(rawHeaderRole)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');
    const normalizedAllowedRoles = allowedRoles.map((role) =>
      role.toLowerCase().replace(/\s+/g, ''),
    );

    if (!normalizedAllowedRoles.includes(userRole)) {
      next(
        new ForbiddenError(
          `Access denied. This action requires one of the following roles: ${allowedRoles.join(', ')}. Your current role is: ${rawHeaderRole}`,
        ),
      );
      return;
    }

    next();
  };
}

export function createProductsRouter(
  controller: ProductsController = productsController,
): Router {
  const router = Router();

  router.get(
    '/',
    requireRoles('superuser', 'admin', 'cashier', 'inventorymanager', 'customer'),
    validateQuery(listProductsQuerySchema),
    controller.findAll,
  );

  router.get(
    '/categories',
    requireRoles('superuser', 'admin', 'cashier', 'inventorymanager', 'customer'),
    controller.getCategories,
  );

  router.get(
    '/barcode/:barcode',
    requireRoles('superuser', 'admin', 'cashier', 'inventorymanager'),
    validate({ params: productBarcodeParamsSchema }),
    controller.findByBarcode,
  );

  router.get(
    '/:id',
    requireRoles('superuser', 'admin', 'cashier', 'inventorymanager', 'customer'),
    validate({ params: productIdParamsSchema }),
    controller.findOne,
  );

  router.post(
    '/',
    requireRoles('superuser', 'admin', 'inventorymanager'),
    validate({ body: createProductSchema }),
    controller.create,
  );

  router.put(
    '/:id',
    requireRoles('superuser', 'admin', 'inventorymanager'),
    validate({ params: productIdParamsSchema, body: updateProductSchema }),
    controller.update,
  );

  router.delete(
    '/:id',
    requireRoles('superuser', 'admin', 'inventorymanager'),
    validate({ params: productIdParamsSchema }),
    controller.remove,
  );

  return router;
}

export const productsRouter = createProductsRouter();
