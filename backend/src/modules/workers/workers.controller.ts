/// <reference path="../../types/express.d.ts" />
import { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import { workersService, WorkersService } from './workers.service';
import { WorkerListQuery } from './workers.validation';

export class WorkersController {
  constructor(private readonly service: WorkersService = workersService) {}

  /**
   * GET /workers
   * Fetch workers with filtering, searching, and pagination.
   */
  getWorkers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getWorkers(req.query as unknown as WorkerListQuery);
      sendSuccess(res, 200, 'Workers retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /workers/:id
   * Fetch worker details.
   */
  getWorkerById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getWorkerById(req.params['id'] as string);
      sendSuccess(res, 200, 'Worker details retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /workers/:id/reviews
   * Fetch worker reviews.
   */
  getWorkerReviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = req.query['page'] ? parseInt(req.query['page'] as string, 10) : 1;
      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 10;
      const result = await this.service.getWorkerReviews(req.params['id'] as string, page, limit);
      sendSuccess(res, 200, 'Worker reviews retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * PATCH /workers/me/availability
   * Allow authenticated workers to update their availability.
   */
  updateAvailability = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }
      const result = await this.service.updateAvailability(req.user.userId, req.body);
      sendSuccess(res, 200, 'Worker availability updated successfully', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /workers/me/stats
   * Fetch worker statistics.
   */
  getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }
      const result = await this.service.getWorkerStats(req.user.userId);
      sendSuccess(res, 200, 'Worker statistics retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /workers/me/profile
   * Fetch profile for current authenticated worker.
   */
  getMyProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }
      const result = await this.service.getMyProfile(req.user.userId);
      sendSuccess(res, 200, 'Worker profile retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * PATCH /workers/me/profile
   * Update profile for current authenticated worker.
   */
  updateMyProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }
      const result = await this.service.updateMyProfile(req.user.userId, req.body);
      sendSuccess(res, 200, 'Worker profile updated successfully', result);
    } catch (err) {
      next(err);
    }
  };
}

export const workersController = new WorkersController();
