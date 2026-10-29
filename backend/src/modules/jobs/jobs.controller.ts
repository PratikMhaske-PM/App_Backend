/// <reference path="../../types/express.d.ts" />
import { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import { jobsService, JobsService } from './jobs.service';
import { JobFilterQuery } from './jobs.types';

export class JobsController {
  constructor(private readonly service: JobsService = jobsService) {}

  /**
   * API 14: GET /jobs/requests
   * Role: Worker
   */
  getRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }
      const query: JobFilterQuery = {
        status: req.query['status'] as string | undefined,
        page: req.query['page'] ? parseInt(req.query['page'] as string, 10) : 1,
        limit: req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 10,
      };
      const result = await this.service.getJobRequests(req.user.userId, query);
      sendSuccess(res, 200, 'Job requests retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * API 15: GET /jobs/me
   * Role: Worker
   */
  getMyJobs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }
      const query: JobFilterQuery = {
        status: req.query['status'] as string | undefined,
        page: req.query['page'] ? parseInt(req.query['page'] as string, 10) : 1,
        limit: req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 10,
      };
      const result = await this.service.getMyJobs(req.user.userId, query);
      sendSuccess(res, 200, 'Worker jobs retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * API 16: GET /jobs/:id
   * Role: Worker
   */
  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }
      const result = await this.service.getJobById(req.params['id'] as string, req.user.userId);
      sendSuccess(res, 200, 'Job details retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * API 17: PATCH /jobs/:id/status
   * Role: Worker
   */
  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }
      const result = await this.service.updateJobStatus(
        req.params['id'] as string,
        req.user.userId,
        req.body
      );
      sendSuccess(res, 200, 'Job status updated successfully', result);
    } catch (err) {
      next(err);
    }
  };
}

export const jobsController = new JobsController();
