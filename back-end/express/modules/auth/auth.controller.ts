import { NextFunction, Request, Response } from 'express';
import { logger } from '../../utils/logger';
import { authService, AuthService } from './auth.service';
import { LoginDto } from './auth.schema';

/** Auth Module Controller. */
export class AuthController {
  constructor(private readonly service: AuthService = authService) {}

  public login = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const dto = req.body as LoginDto;
      const result = await this.service.login(dto);

      logger.info('Login succeeded', {
        requestId: req.requestId,
        userId: result.id,
        role: result.role,
      });

      res.status(200).json(result);
    } catch (error) {
      logger.warn('Login failed', {
        requestId: req.requestId,
        username: (req.body as LoginDto)?.username,
      });
      next(error);
    }
  };

  /** Echoes back whichever credential the caller presented. */
  public profile = (req: Request, res: Response, next: NextFunction): void => {
    try {
      res.status(200).json({
        authenticated: true,
        actor: req.auth,
        requestId: req.requestId,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const authController = new AuthController();
