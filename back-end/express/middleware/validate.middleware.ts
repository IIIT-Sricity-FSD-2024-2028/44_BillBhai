import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodType, ZodError } from 'zod';
import { BadRequestError } from '../errors/http-error';

interface ValidationSchema {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Schema Validation Middleware (zod)
 *
 * Parses and replaces `body`, `query` and `params` with their validated,
 * coerced equivalents, so controllers receive typed data and never re-check it.
 *
 * NOTE ON EXPRESS 5: `req.query` is a getter on the request prototype and can
 * no longer be assigned to (`req.query = x` throws in strict mode). The
 * validated value is installed with Object.defineProperty instead, which is
 * the supported replacement.
 */
function assignQuery(req: Request, value: unknown): void {
  Object.defineProperty(req, 'query', {
    value,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}

export const validate = (schema: ValidationSchema): RequestHandler => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        assignQuery(req, await schema.query.parseAsync(req.query));
      }
      if (schema.params) {
        Object.assign(req.params, await schema.params.parseAsync(req.params));
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedMessages = error.issues
          .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
          .join('; ');

        next(new BadRequestError(`Validation failed: ${formattedMessages}`, error.issues));
        return;
      }
      next(error);
    }
  };
};
