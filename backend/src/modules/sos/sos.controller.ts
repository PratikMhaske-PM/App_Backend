/// <reference path="../../types/express.d.ts" />
import { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import { sosService, SosService } from './sos.service';

export class SosController {
  constructor(private readonly service: SosService = sosService) {}

  /**
   * API 29: POST /sos
   * Role: All authenticated users
   */
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }
      const result = await this.service.createAlert(req.user.userId, req.body);
      sendSuccess(res, 201, 'SOS emergency alert logged successfully', result);
    } catch (err) {
      next(err);
    }
  };
}

export const sosController = new SosController();
