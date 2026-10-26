import { Router } from 'express';
import { authenticateToken, requireRole } from '../../middlewares/auth.middleware';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../middlewares/validate.middleware';
import { workersController, WorkersController } from './workers.controller';
import {
  updateAvailabilitySchema,
  updateWorkerProfileSchema,
  workerIdParamSchema,
  workerListQuerySchema,
  workerReviewsQuerySchema,
} from './workers.validation';

export function createWorkersRouter(controller: WorkersController = workersController): Router {
  const router = Router();

  /**
   * Worker Dashboard Endpoints (Must be registered BEFORE /:id to prevent route clash)
   */

  /**
   * PATCH /workers/me/availability
   * Allow authenticated workers to update their availability.
   */
  router.patch(
    '/me/availability',
    authenticateToken,
    requireRole('worker'),
    validateBody(updateAvailabilitySchema),
    controller.updateAvailability
  );

  /**
   * GET /workers/me/stats
   * Fetch worker statistics.
   */
  router.get(
    '/me/stats',
    authenticateToken,
    requireRole('worker'),
    controller.getStats
  );

  /**
   * GET /workers/me/profile
   * Fetch current worker profile.
   */
  router.get(
    '/me/profile',
    authenticateToken,
    requireRole('worker'),
    controller.getMyProfile
  );

  /**
   * PATCH /workers/me/profile
   * Update current worker profile.
   */
  router.patch(
    '/me/profile',
    authenticateToken,
    requireRole('worker'),
    validateBody(updateWorkerProfileSchema),
    controller.updateMyProfile
  );

  /**
   * Public Worker Endpoints
   */

  /**
   * GET /workers
   * Fetch workers with filtering, searching, and pagination.
   */
  router.get(
    '/',
    validateQuery(workerListQuerySchema),
    controller.getWorkers
  );

  /**
   * GET /workers/:id
   * Fetch worker details.
   */
  router.get(
    '/:id',
    validateParams(workerIdParamSchema),
    controller.getWorkerById
  );

  /**
   * GET /workers/:id/reviews
   * Fetch worker reviews.
   */
  router.get(
    '/:id/reviews',
    validateParams(workerIdParamSchema),
    validateQuery(workerReviewsQuerySchema),
    controller.getWorkerReviews
  );

  return router;
}

export const workersRouter = createWorkersRouter();
