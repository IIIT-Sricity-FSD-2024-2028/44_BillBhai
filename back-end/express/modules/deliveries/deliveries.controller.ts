import { NextFunction, Request, Response } from 'express';
import { deliveriesService, DeliveriesService } from './deliveries.service';
import { CreateDeliveryDto, UpdateDeliveryDto } from './deliveries.schema';

/**
 * Deliveries Module Controller
 *
 * Extracts HTTP input, delegates to the service, sets an explicit status code,
 * and forwards every failure to the global error pipeline via next().
 */
export class DeliveriesController {
  constructor(private readonly service: DeliveriesService = deliveriesService) {}

  public findAll = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const status =
        typeof req.query.status === 'string' ? req.query.status : undefined;
      res.status(200).json(this.service.findAll(status));
    } catch (error) {
      next(error);
    }
  };

  public findByOrder = (req: Request, res: Response, next: NextFunction): void => {
    try {
      res.status(200).json(this.service.findByOrder(String(req.params.orderId)));
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
      const created = this.service.create(req.body as CreateDeliveryDto);
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  };

  public update = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const updated = this.service.update(
        String(req.params.id),
        req.body as UpdateDeliveryDto,
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

export const deliveriesController = new DeliveriesController();
