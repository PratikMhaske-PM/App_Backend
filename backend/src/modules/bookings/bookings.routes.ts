import { Router } from 'express';
import { authenticateToken, requireRole } from '../../middlewares/auth.middleware';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../middlewares/validate.middleware';
import { bookingsController, BookingsController } from './bookings.controller';
import {
  bookingIdParamSchema,
  cancelBookingSchema,
  createBookingSchema,
  getMyBookingsQuerySchema,
  verifyQrSchema,
} from './bookings.validation';

export function createBookingsRouter(
  controller: BookingsController = bookingsController
): Router {
  const router = Router();

  // All booking routes require authentication
  router.use(authenticateToken);

  /**
   * API 1: POST /bookings
   * Role: customer
   * Allow an authenticated customer to create a booking with an available worker.
   */
  router.post(
    '/',
    requireRole('customer', 'user'),
    validateBody(createBookingSchema),
    controller.create
  );

  /**
   * API 2: GET /bookings/me
   * Role: customer
   * Fetch bookings belonging to the authenticated customer.
   * (Registered BEFORE /:id to prevent route clash)
   */
  router.get(
    '/me',
    requireRole('customer', 'user'),
    validateQuery(getMyBookingsQuerySchema),
    controller.getMyBookings
  );

  /**
   * General list bookings (role-aware: customer sees own, worker sees assigned, admin sees all)
   */
  router.get('/', controller.getAll);

  /**
   * API 5: GET /bookings/:id/qr
   * Role: customer
   * Generate or retrieve QR code associated with a booking.
   * (Registered BEFORE /:id to prevent route clash)
   */
  router.get(
    '/:id/qr',
    requireRole('customer', 'user'),
    validateParams(bookingIdParamSchema),
    controller.getQrCode
  );

  /**
   * API 18: POST /bookings/:id/verify-qr
   * Role: worker
   * Verify booking QR code upon job service execution.
   */
  router.post(
    '/:id/verify-qr',
    requireRole('worker'),
    validateParams(bookingIdParamSchema),
    validateBody(verifyQrSchema),
    controller.verifyQr
  );

  /**
   * API 4: PATCH /bookings/:id/cancel
   * Role: customer
   * Allow a customer to cancel their own booking.
   */
  router.patch(
    '/:id/cancel',
    validateParams(bookingIdParamSchema),
    validateBody(cancelBookingSchema),
    controller.cancel
  );

  /**
   * PATCH /bookings/:id/accept
   * Assigned worker accepts booking.
   */
  router.patch(
    '/:id/accept',
    requireRole('worker'),
    validateParams(bookingIdParamSchema),
    controller.accept
  );

  /**
   * PATCH /bookings/:id/reject
   * Assigned worker rejects booking.
   */
  router.patch(
    '/:id/reject',
    requireRole('worker'),
    validateParams(bookingIdParamSchema),
    controller.reject
  );

  /**
   * PATCH /bookings/:id/complete
   * Worker or Customer marks booking as completed.
   */
  router.patch(
    '/:id/complete',
    validateParams(bookingIdParamSchema),
    controller.complete
  );

  /**
   * API 3: GET /bookings/:id
   * Roles: customer, worker
   * Fetch complete details of a specific booking with ownership validation.
   */
  router.get(
    '/:id',
    validateParams(bookingIdParamSchema),
    controller.getById
  );

  return router;
}

export const bookingsRouter = createBookingsRouter();
