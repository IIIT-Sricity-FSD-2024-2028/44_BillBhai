import { NextFunction, Request, Response } from 'express';
import { customersService, CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto } from './customers.schema';

/**
 * Customers Module Controller
 *
 * Extracts HTTP input, delegates to the service, sets an explicit status code,
 * and forwards every failure to the global error pipeline via next().
 */
export class CustomersController {
  constructor(private readonly service: CustomersService = customersService) {}

  public findAll = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const companyId =
        typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
      res.status(200).json(this.service.findAll(companyId));
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

  public findByPhone = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const companyId =
        typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
      res
        .status(200)
        .json(this.service.findByPhone(String(req.params.phone), companyId));
    } catch (error) {
      next(error);
    }
  };

  public create = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const created = this.service.create(req.body as CreateCustomerDto);
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  };

  public update = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const updated = this.service.update(
        String(req.params.id),
        req.body as UpdateCustomerDto,
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

export const customersController = new CustomersController();
