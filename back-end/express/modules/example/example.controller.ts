import { Request, Response, NextFunction } from 'express';
import { ExampleService, exampleService } from './example.service';
import { CreateExampleDto, UpdateExampleDto } from './example.schema';

/**
 * Example Module Controller
 *
 * Responsibilities:
 * - Reads parameters, query strings, and body from the HTTP request.
 * - Delegates business logic execution to the service.
 * - Formats and sends HTTP responses (status codes, JSON payloads).
 * - Passes unhandled errors to next() for global error handling.
 */
export class ExampleController {
  constructor(private readonly service: ExampleService = exampleService) {}

  public getAll = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const items = this.service.findAll();
      res.status(200).json(items);
    } catch (error) {
      next(error);
    }
  };

  public getById = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const id = String(req.params.id);
      const item = this.service.findById(id);
      if (!item) {
        res
          .status(404)
          .json({ statusCode: 404, message: `Item ${id} not found` });
        return;
      }
      res.status(200).json(item);
    } catch (error) {
      next(error);
    }
  };

  public create = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const dto = req.body as CreateExampleDto;
      if (!dto.name) {
        res
          .status(400)
          .json({ statusCode: 400, message: 'Field "name" is required' });
        return;
      }
      const created = this.service.create(dto);
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  };

  public update = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const id = String(req.params.id);
      const dto = req.body as UpdateExampleDto;
      const updated = this.service.update(id, dto);
      if (!updated) {
        res
          .status(404)
          .json({ statusCode: 404, message: `Item ${id} not found` });
        return;
      }
      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  };

  public remove = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const id = String(req.params.id);
      const deleted = this.service.remove(id);
      if (!deleted) {
        res
          .status(404)
          .json({ statusCode: 404, message: `Item ${id} not found` });
        return;
      }
      res.status(200).json({ message: `Item ${id} deleted successfully` });
    } catch (error) {
      next(error);
    }
  };
}

export const exampleController = new ExampleController();
