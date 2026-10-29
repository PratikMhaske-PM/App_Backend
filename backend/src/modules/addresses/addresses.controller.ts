/// <reference path="../../types/express.d.ts" />
import { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import { addressesService, AddressesService } from './addresses.service';

export class AddressesController {
  constructor(private readonly service: AddressesService = addressesService) {}

  /**
   * API 22: GET /addresses
   */
  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }
      const page = req.query['page'] ? parseInt(req.query['page'] as string, 10) : 1;
      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 10;
      const result = await this.service.getAddresses(req.user.userId, page, limit);
      sendSuccess(res, 200, 'Addresses retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * API 23: POST /addresses
   */
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }
      const result = await this.service.createAddress(req.user.userId, req.body);
      sendSuccess(res, 201, 'Address created successfully', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * API 24: PATCH /addresses/:id
   */
  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }
      const result = await this.service.updateAddress(
        req.params['id'] as string,
        req.user.userId,
        req.body
      );
      sendSuccess(res, 200, 'Address updated successfully', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * API 25: DELETE /addresses/:id
   */
  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }
      await this.service.deleteAddress(req.params['id'] as string, req.user.userId);
      sendSuccess(res, 200, 'Address deleted successfully');
    } catch (err) {
      next(err);
    }
  };
}

export const addressesController = new AddressesController();
