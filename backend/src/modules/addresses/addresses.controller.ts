/// <reference path="../../types/express.d.ts" />
import { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import { addressesService, AddressesService } from './addresses.service';

export class AddressesController {
  constructor(private readonly service: AddressesService = addressesService) {}

  /**
   * GET /addresses
   * List all addresses for the authenticated user.
   */
  getAddresses = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw AppError.unauthorized('Authentication required');
      const result = await this.service.getAddresses(req.user.userId);
      sendSuccess(res, 200, 'Addresses retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /addresses
   * Create a new address for the authenticated user.
   */
  createAddress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw AppError.unauthorized('Authentication required');
      const result = await this.service.createAddress(req.user.userId, req.body);
      sendSuccess(res, 201, 'Address created successfully', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * PATCH /addresses/:id
   * Update an address owned by the authenticated user.
   */
  updateAddress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw AppError.unauthorized('Authentication required');
      const result = await this.service.updateAddress(req.user.userId, req.params['id'] as string, req.body);
      sendSuccess(res, 200, 'Address updated successfully', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * DELETE /addresses/:id
   * Delete an address owned by the authenticated user.
   */
  deleteAddress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) throw AppError.unauthorized('Authentication required');
      await this.service.deleteAddress(req.user.userId, req.params['id'] as string);
      sendSuccess(res, 200, 'Address deleted successfully');
    } catch (err) {
      next(err);
    }
  };
}

export const addressesController = new AddressesController();
