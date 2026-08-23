import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { HttpError } from '../errors/http-error';

export const errorHandler: ErrorRequestHandler = (
  err: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  const isProduction = process.env.NODE_ENV === 'production';

  // 1. Handle Known HttpError Instances
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({
      statusCode: err.statusCode,
      message: err.message,
      error: err.error,
      ...(err.details && { details: err.details }),
      ...(!isProduction && { stack: err.stack }),
    });
    return;
  }

  // 2. Fallback for Unhandled/Unexpected Errors (500)
  console.error('[Unhandled Error]:', err);

  res.status(500).json({
    statusCode: 500,
    message: isProduction ? 'Internal Server Error' : err.message,
    error: 'Internal Server Error',
    ...(!isProduction && { stack: err.stack }),
  });
};
