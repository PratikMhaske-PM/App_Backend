/// <reference path="../../types/express.d.ts" />
import { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import { kycService, KycService } from './kyc.service';

export class KycController {
  constructor(private readonly service: KycService = kycService) {}

  /**
   * POST /kyc/submit
   * Worker submits KYC document details.
   */
  submit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw AppError.unauthorized('Authentication required');
      const result = await this.service.submitKyc(req.user.userId, req.body);
      sendSuccess(res, 201, 'KYC submission received and is under review', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /kyc/status
   * Worker retrieves their current KYC submission status.
   */
  getStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw AppError.unauthorized('Authentication required');
      const result = await this.service.getKycStatus(req.user.userId);
      if (!result) {
        sendSuccess(res, 200, 'No KYC submission found', null);
        return;
      }
      sendSuccess(res, 200, 'KYC status retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * PATCH /admin/kyc/:id
   * Admin approves or rejects a KYC submission.
   */
  adminUpdate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw AppError.unauthorized('Authentication required');
      const result = await this.service.adminUpdateKyc(
        req.params['id'] as string,
        req.user.userId,
        req.body
      );
      sendSuccess(res, 200, `KYC submission ${req.body.status}`, result);
    } catch (err) {
      next(err);
    }
  };
}

export const kycController = new KycController();
