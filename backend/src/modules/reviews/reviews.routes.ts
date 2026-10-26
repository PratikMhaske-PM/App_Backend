import { Router } from 'express';
import { authenticateToken, requireRole } from '../../middlewares/auth.middleware';
import { validateBody, validateParams } from '../../middlewares/validate.middleware';
import { reviewsController, ReviewsController } from './reviews.controller';
import {
  createReviewSchema,
  reviewIdParamSchema,
  updateReviewSchema,
} from './reviews.validation';

export function createReviewsRouter(controller: ReviewsController = reviewsController): Router {
  const router = Router();

  /**
   * POST /reviews
   * Submit review (Customer only).
   */
  router.post(
    '/',
    authenticateToken,
    requireRole('customer', 'user'),
    validateBody(createReviewSchema),
    controller.create
  );

  /**
   * GET /reviews/:id
   * Fetch a single review by ID.
   */
  router.get(
    '/:id',
    validateParams(reviewIdParamSchema),
    controller.getById
  );

  /**
   * PATCH /reviews/:id
   * Update review (Owner customer only).
   */
  router.patch(
    '/:id',
    authenticateToken,
    validateParams(reviewIdParamSchema),
    validateBody(updateReviewSchema),
    controller.update
  );

  /**
   * DELETE /reviews/:id
   * Delete review (Owner customer or Admin).
   */
  router.delete(
    '/:id',
    authenticateToken,
    validateParams(reviewIdParamSchema),
    controller.delete
  );

  return router;
}

export const reviewsRouter = createReviewsRouter();
