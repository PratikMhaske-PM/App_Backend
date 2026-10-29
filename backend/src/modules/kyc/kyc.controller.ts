/// <reference path="../../types/express.d.ts" />
import { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import { kycService, KycService } from './kyc.service';

export class KycController {
  constructor(private readonly service: KycService = kycService) {}

  /**
   * API 26: POST /kyc/submit
   * Role: Worker
   */
  submit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }
      const result = await this.service.submitKyc(req.user.userId, req.body);
      sendSuccess(res, 201, 'KYC application submitted successfully', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * API 27: GET /kyc/status
   * Role: Worker
   */
  getStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }
      const result = await this.service.getKycStatus(req.user.userId);
      sendSuccess(res, 200, 'KYC status retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * API 28: PATCH /admin/kyc/:id
   * Role: Admin
   */
  review = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }
      const result = await this.service.reviewKyc(
        req.params['id'] as string,
        req.user.userId,
        req.body
      );
      sendSuccess(res, 200, `KYC application status updated to '${req.body.status}'`, result);
    } catch (err) {
      next(err);
    }
  };
}

export const kycController = new KycController();
