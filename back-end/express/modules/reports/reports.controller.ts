import { NextFunction, Request, Response } from 'express';
import { reportsService, ReportsService } from './reports.service';

/**
 * Reports Module Controller
 *
 * Extracts HTTP input, delegates to the service, sets an explicit status code,
 * and forwards every failure to the global error pipeline via next(). The
 * reports endpoints take no input at all, so each method is a straight
 * delegation.
 */
export class ReportsController {
  constructor(private readonly service: ReportsService = reportsService) {}

  public getSalesReport = (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    try {
      res.status(200).json(this.service.getSalesReport());
    } catch (error) {
      next(error);
    }
  };

  public getInventoryReport = (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    try {
      res.status(200).json(this.service.getInventoryReport());
    } catch (error) {
      next(error);
    }
  };

  public getReturnsReport = (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    try {
      res.status(200).json(this.service.getReturnsReport());
    } catch (error) {
      next(error);
    }
  };
}

export const reportsController = new ReportsController();
