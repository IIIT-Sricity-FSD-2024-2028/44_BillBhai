import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '../errors/http-error';

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new NotFoundError(`Cannot ${req.method} ${req.originalUrl}`));
};
