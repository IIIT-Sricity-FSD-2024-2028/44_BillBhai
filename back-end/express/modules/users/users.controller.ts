import { NextFunction, Request, Response } from 'express';
import { usersService, UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './users.schema';

/**
 * Users Module Controller
 *
 * Extracts HTTP input, delegates to the service, sets an explicit status code,
 * and forwards every failure to the global error pipeline via next().
 */
export class UsersController {
  constructor(private readonly service: UsersService = usersService) {}

  public findAll = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const companyId =
        typeof req.query.companyId === 'string' ? req.query.companyId : undefined;
      const role = typeof req.query.role === 'string' ? req.query.role : undefined;
      res.status(200).json(this.service.findAll(companyId, role));
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

  public create = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const created = await this.service.create(req.body as CreateUserDto);
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  };

  public update = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const updated = await this.service.update(
        String(req.params.id),
        req.body as UpdateUserDto,
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

export const usersController = new UsersController();
