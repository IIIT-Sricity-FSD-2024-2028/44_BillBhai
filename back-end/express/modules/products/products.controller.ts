import { NextFunction, Request, Response } from 'express';
import { productsService, ProductsService } from './products.service';
import {
  CreateProductDto,
  UpdateProductDto,
} from './products.schema';

/**
 * Products Module Controller
 *
 * Responsibilities:
 * - Reads request data from Express.
 * - Delegates all business operations to the service layer.
 * - Returns explicit HTTP status codes.
 * - Forwards unexpected errors to the global error pipeline.
 */
export class ProductsController {
  constructor(private readonly service: ProductsService = productsService) {}

  public findAll = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const category =
        typeof req.query.category === 'string' ? req.query.category : undefined;
      const products = this.service.findAll(category);
      res.status(200).json(products);
    } catch (error) {
      next(error);
    }
  };

  public getCategories = (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    try {
      const categories = this.service.getCategories();
      res.status(200).json(categories);
    } catch (error) {
      next(error);
    }
  };

  public findByBarcode = (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    try {
      const barcode = String(req.params.barcode);
      const product = this.service.findByBarcode(barcode);
      res.status(200).json(product);
    } catch (error) {
      next(error);
    }
  };

  public findOne = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const id = String(req.params.id);
      const product = this.service.findOne(id);
      res.status(200).json(product);
    } catch (error) {
      next(error);
    }
  };

  public create = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const dto = req.body as CreateProductDto;
      const created = this.service.create(dto);
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  };

  public update = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const id = String(req.params.id);
      const dto = req.body as UpdateProductDto;
      const updated = this.service.update(id, dto);
      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  };

  public remove = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const id = String(req.params.id);
      const deleted = this.service.remove(id);
      res.status(200).json(deleted);
    } catch (error) {
      next(error);
    }
  };
}

export const productsController = new ProductsController();

