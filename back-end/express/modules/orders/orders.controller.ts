import { NextFunction, Request, Response } from 'express';
import { ordersService, OrdersService } from './orders.service';
import {
  CreateBillDto,
  CreateOrderDto,
  CreatePaymentDto,
  UpdateOrderDto,
  ValidatePromotionDto,
} from './orders.schema';

/**
 * Orders Module Controller
 *
 * Extracts HTTP input, delegates to the service, sets an explicit status code,
 * and forwards every failure to the global error pipeline via next().
 */
export class OrdersController {
  constructor(private readonly service: OrdersService = ordersService) {}

  public findAll = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const companyId =
        typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
      const status =
        typeof req.query.status === 'string' ? req.query.status : undefined;
      res.status(200).json(this.service.findAllOrders(companyId, status));
    } catch (error) {
      next(error);
    }
  };

  public findOne = (req: Request, res: Response, next: NextFunction): void => {
    try {
      res.status(200).json(this.service.findOneOrder(String(req.params.id)));
    } catch (error) {
      next(error);
    }
  };

  public create = (req: Request, res: Response, next: NextFunction): void => {
    try {
      res.status(201).json(this.service.createOrder(req.body as CreateOrderDto));
    } catch (error) {
      next(error);
    }
  };

  public update = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const updated = this.service.updateOrder(
        String(req.params.id),
        req.body as UpdateOrderDto,
      );
      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  };

  public remove = (req: Request, res: Response, next: NextFunction): void => {
    try {
      res.status(200).json(this.service.removeOrder(String(req.params.id)));
    } catch (error) {
      next(error);
    }
  };

  public validatePromotion = (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    try {
      const dto = req.body as ValidatePromotionDto;
      res.status(200).json(this.service.validatePromotion(dto.code, dto.subtotal));
    } catch (error) {
      next(error);
    }
  };

  public findAllBills = (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    try {
      res.status(200).json(this.service.findAllBills());
    } catch (error) {
      next(error);
    }
  };

  public findOneBill = (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    try {
      res.status(200).json(this.service.findOneBill(String(req.params.billNo)));
    } catch (error) {
      next(error);
    }
  };

  public createBill = (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    try {
      res.status(201).json(this.service.createBill(req.body as CreateBillDto));
    } catch (error) {
      next(error);
    }
  };

  public findAllPayments = (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    try {
      res.status(200).json(this.service.findAllPayments());
    } catch (error) {
      next(error);
    }
  };

  public findOnePayment = (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    try {
      res.status(200).json(this.service.findOnePayment(String(req.params.billNo)));
    } catch (error) {
      next(error);
    }
  };

  public createPayment = (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    try {
      res
        .status(201)
        .json(this.service.createPayment(req.body as CreatePaymentDto));
    } catch (error) {
      next(error);
    }
  };
}

export const ordersController = new OrdersController();
