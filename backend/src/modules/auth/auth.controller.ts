/// <reference path="../../types/express.d.ts" />
import { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../utils/apiResponse';
import { authService, AuthService } from './auth.service';

/**
 * Controller handling HTTP requests for the authentication module.
 * Controllers remain thin and delegate domain logic to services.
 */
export class AuthController {
  constructor(private readonly service: AuthService = authService) {}

  /**
   * POST /api/auth/register
   */
  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.register(req.body);
      sendSuccess(res, 201, 'Registration successful', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/auth/login
   */
  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.login(req.body);
      sendSuccess(res, 200, 'Login successful', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/auth/me
   * Protected route to retrieve authenticated user context.
   */
  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, 200, 'User profile retrieved successfully', {
        user: req.user,
      });
    } catch (err) {
      next(err);
    }
  };
}

export const authController = new AuthController();
