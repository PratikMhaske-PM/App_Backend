import { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../utils/apiResponse';
import { adminService, AdminService } from './admin.service';

export class AdminController {
  constructor(private readonly service: AdminService = adminService) {}

  /**
   * GET /admin/workers
   * Fetch all workers for administrative verification review.
   */
  getAllWorkers = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getAllWorkers();
      sendSuccess(res, 200, 'Workers list retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * PATCH /admin/workers/:id/verify
   * Approve or reject worker verification.
   */
  verifyWorker = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.verifyWorker(
        req.params['id'] as string,
        req.body
      );
      sendSuccess(res, 200, `Worker status updated to '${req.body.status}'`, result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /admin/stats
   * Fetch system-wide platform statistics.
   */
  getSystemStats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getSystemStats();
      sendSuccess(res, 200, 'System statistics retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  };
}

export const adminController = new AdminController();
