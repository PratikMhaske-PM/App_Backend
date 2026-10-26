/// <reference path="../../types/express.d.ts" />
import { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import { usersService, UsersService } from './users.service';

export class UsersController {
  constructor(private readonly service: UsersService = usersService) {}

  /**
   * GET /users/me
   * Retrieve current user profile.
   */
  getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }
      const result = await this.service.getProfile(req.user.userId);
      sendSuccess(res, 200, 'User profile retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * PATCH /users/me
   * Update current user profile.
   */
  updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }
      const result = await this.service.updateProfile(req.user.userId, req.body);
      sendSuccess(res, 200, 'Profile updated successfully', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * PATCH /users/me/password
   * Securely update password.
   */
  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }
      await this.service.changePassword(req.user.userId, req.body);
      sendSuccess(res, 200, 'Password updated successfully');
    } catch (err) {
      next(err);
    }
  };
}

export const usersController = new UsersController();
