/// <reference path="../../types/express.d.ts" />
import { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../utils/apiResponse';
import { AppError } from '../../utils/AppError';
import { reviewsService, ReviewsService } from './reviews.service';

export class ReviewsController {
  constructor(private readonly service: ReviewsService = reviewsService) {}

  /**
   * POST /reviews
   * Submit a review for a completed booking.
   */
  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }
      const result = await this.service.createReview(req.user.userId, req.body);
      sendSuccess(res, 201, 'Review submitted successfully', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /reviews/:id
   * Fetch review details.
   */
  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getReviewById(req.params['id'] as string);
      sendSuccess(res, 200, 'Review retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * PATCH /reviews/:id
   * Update own review.
   */
  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }
      const result = await this.service.updateReview(
        req.params['id'] as string,
        req.user.userId,
        req.body
      );
      sendSuccess(res, 200, 'Review updated successfully', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * DELETE /reviews/:id
   * Delete own review or admin deletion.
   */
  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw AppError.unauthorized('Authentication required');
      }
      await this.service.deleteReview(req.params['id'] as string, req.user);
      sendSuccess(res, 200, 'Review deleted successfully');
    } catch (err) {
      next(err);
    }
  };
}

export const reviewsController = new ReviewsController();
