import { NextFunction, Request, Response } from 'express';
import { suppliersService, SuppliersService } from './suppliers.service';
import { CreateSupplierDto, UpdateSupplierDto } from './suppliers.schema';

/**
 * Suppliers Module Controller
 *
 * Extracts HTTP input, delegates to the service, sets an explicit status code,
 * and forwards every failure to the global error pipeline via next().
 */
export class SuppliersController {
  constructor(private readonly service: SuppliersService = suppliersService) {}

  public findAll = (_req: Request, res: Response, next: NextFunction): void => {
    try {
      res.status(200).json(this.service.findAll());
    } catch (error) {
      next(error);
    }
  };

  public findOne = (req: Request, res: Response, next: NextFunction): void => {
    try {
      res.status(200).json(this.service.findOne(String(req.params.id)));
    } catch (error) {
      next(error);
    }
  };

  public create = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const created = this.service.create(req.body as CreateSupplierDto);
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  };

  public update = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const updated = this.service.update(
        String(req.params.id),
        req.body as UpdateSupplierDto,
      );
      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  };

  public remove = (req: Request, res: Response, next: NextFunction): void => {
    try {
      res.status(200).json(this.service.remove(String(req.params.id)));
    } catch (error) {
      next(error);
    }
  };
}

export const suppliersController = new SuppliersController();
