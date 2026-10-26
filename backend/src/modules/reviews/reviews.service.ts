import { db } from '../../config/database';
import { IDatabase } from '../../database/sqlite';
import { defaultBookingRepository, IBookingRepository } from '../../repositories/booking.repo';
import { defaultReviewRepository, IReviewRepository } from '../../repositories/review.repo';
import { defaultWorkerRepository, IWorkerRepository } from '../../repositories/worker.repo';
import { AuthUserPayload } from '../../modules/auth/auth.types';
import { Review } from '../../types/common.types';
import { AppError } from '../../utils/AppError';
import { CreateReviewInput, UpdateReviewInput } from './reviews.types';

export class ReviewsService {
  constructor(
    private readonly reviewRepo: IReviewRepository = defaultReviewRepository,
    private readonly bookingRepo: IBookingRepository = defaultBookingRepository,
    private readonly workerRepo: IWorkerRepository = defaultWorkerRepository,
    private readonly database: IDatabase = db
  ) {}

  /**
   * Submit a new review for a completed booking.
   * Enforces:
   * 1. Only customer of booking can submit.
   * 2. Booking must be marked 'completed'.
   * 3. Prevents duplicate review for the same booking.
   * 4. Updates worker rating_avg and reviews_count in a transaction.
   */
  async createReview(customerId: string, input: CreateReviewInput): Promise<Review> {
    const bookingId = (input.booking_id || input.bookingId) as string;

    const booking = await this.bookingRepo.findById(bookingId);
    if (!booking) {
      throw AppError.notFound(`Booking with ID '${bookingId}' not found`);
    }

    if (booking.customerId !== customerId) {
      throw AppError.forbidden('Only the customer who made the booking can submit a review');
    }

    if (booking.status !== 'completed') {
      throw AppError.badRequest(
        `Reviews can only be submitted for completed bookings. Current status: '${booking.status}'`
      );
    }

    const existingReview = await this.reviewRepo.findByBookingId(booking.id);
    if (existingReview) {
      throw AppError.badRequest('A review has already been submitted for this booking');
    }

    return this.database.transaction(async () => {
      // 1. Create review
      const review = await this.reviewRepo.create({
        bookingId: booking.id,
        customerId,
        workerId: booking.workerId,
        rating: input.rating,
        comment: input.comment,
      });

      // 2. Recalculate worker average rating and count
      const stats = await this.reviewRepo.calculateWorkerRating(booking.workerId);
      await this.workerRepo.updateRatingAndCount(
        booking.workerId,
        stats.ratingAvg,
        stats.reviewsCount
      );

      return review;
    });
  }

  /**
   * Get review by ID.
   */
  async getReviewById(id: string): Promise<Review> {
    const review = await this.reviewRepo.findById(id);
    if (!review) {
      throw AppError.notFound(`Review with ID '${id}' not found`);
    }
    return review;
  }

  /**
   * Update review.
   * Users can modify only their own reviews.
   */
  async updateReview(
    id: string,
    customerId: string,
    input: UpdateReviewInput
  ): Promise<Review> {
    const existing = await this.reviewRepo.findById(id);
    if (!existing) {
      throw AppError.notFound(`Review with ID '${id}' not found`);
    }

    if (existing.customerId !== customerId) {
      throw AppError.forbidden('You can modify only your own reviews');
    }

    const newRating = input.rating !== undefined ? input.rating : existing.rating;
    const newComment = input.comment !== undefined ? input.comment : existing.comment;

    const updated = await this.reviewRepo.update(id, newRating, newComment);

    // Recalculate worker stats
    const stats = await this.reviewRepo.calculateWorkerRating(existing.workerId);
    await this.workerRepo.updateRatingAndCount(
      existing.workerId,
      stats.ratingAvg,
      stats.reviewsCount
    );

    return updated;
  }

  /**
   * Delete review.
   * Only author customer or admin.
   */
  async deleteReview(id: string, user: AuthUserPayload): Promise<void> {
    const existing = await this.reviewRepo.findById(id);
    if (!existing) {
      throw AppError.notFound(`Review with ID '${id}' not found`);
    }

    if (existing.customerId !== user.userId && user.role !== 'admin') {
      throw AppError.forbidden('You do not have permission to delete this review');
    }

    await this.reviewRepo.delete(id);

    // Recalculate worker stats
    const stats = await this.reviewRepo.calculateWorkerRating(existing.workerId);
    await this.workerRepo.updateRatingAndCount(
      existing.workerId,
      stats.ratingAvg,
      stats.reviewsCount
    );
  }
}

export const reviewsService = new ReviewsService();
