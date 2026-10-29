/// <reference path="../../types/express.d.ts" />
import { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import { bookingsService, BookingsService } from './bookings.service';
import { GetMyBookingsQuery } from './bookings.types';

export class BookingsController {
  constructor(private readonly service: BookingsService = bookingsService) {}

  /**
   * API 1: POST /bookings
   * Role: Customer
   * Create a new booking with an available worker.
   */
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }
      const result = await this.service.createBooking(req.user.userId, req.body);
      sendSuccess(res, 201, 'Booking created successfully', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * API 2: GET /bookings/me
   * Role: Customer
   * Fetch bookings belonging strictly to the authenticated customer.
   */
  getMyBookings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }
      const query: GetMyBookingsQuery = {
        status: req.query['status'] as string | undefined,
        page: req.query['page'] ? parseInt(req.query['page'] as string, 10) : 1,
        limit: req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 10,
      };
      const result = await this.service.getMyBookings(req.user.userId, query);
      sendSuccess(res, 200, 'Customer bookings retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * API 3: GET /bookings/:id
   * Roles: Customer, Worker (and Admin)
   * Fetch complete details of a specific booking with ownership verification.
   */
  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }
      const result = await this.service.getBookingById(req.params['id'] as string, req.user);
      sendSuccess(res, 200, 'Booking details retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * API 4: PATCH /bookings/:id/cancel
   * Role: Customer
   * Allow customer to cancel their own booking.
   */
  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }
      const result = await this.service.cancelBooking(
        req.params['id'] as string,
        req.user,
        req.body
      );
      sendSuccess(res, 200, 'Booking cancelled successfully', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * API 5: GET /bookings/:id/qr
   * Role: Customer
   * Generate or retrieve QR code associated with a booking.
   */
  getQrCode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }
      const result = await this.service.getBookingQrCode(req.params['id'] as string, req.user);
      sendSuccess(res, 200, 'Booking QR code generated successfully', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /bookings
   * General list bookings for user (customer sees own, worker sees assigned, admin sees all).
   */
  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }
      const status = req.query['status'] as string | undefined;
      const page = req.query['page'] ? parseInt(req.query['page'] as string, 10) : 1;
      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 10;
      const result = await this.service.getBookings(req.user, status, page, limit);
      sendSuccess(res, 200, 'Bookings retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * PATCH /bookings/:id/accept
   * Assigned worker accepts booking.
   */
  accept = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }
      const result = await this.service.acceptBooking(req.params['id'] as string, req.user);
      sendSuccess(res, 200, 'Booking accepted successfully', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * PATCH /bookings/:id/reject
   * Assigned worker rejects booking.
   */
  reject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }
      const result = await this.service.rejectBooking(req.params['id'] as string, req.user);
      sendSuccess(res, 200, 'Booking rejected successfully', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * PATCH /bookings/:id/complete
   * Worker or Customer marks booking as completed.
   */
  complete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }
      const result = await this.service.completeBooking(req.params['id'] as string, req.user);
      sendSuccess(res, 200, 'Booking marked as completed', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * API 18: POST /bookings/:id/verify-qr
   * Role: Worker
   * Verify a booking's QR code during service verification.
   */
  verifyQr = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }
      const result = await this.service.verifyQr(
        req.params['id'] as string,
        req.user,
        req.body
      );
      sendSuccess(res, 200, 'Booking QR code verified successfully', result);
    } catch (err) {
      next(err);
    }
  };
}

export const bookingsController = new BookingsController();
