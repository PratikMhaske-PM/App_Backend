import { Review } from '../../types/common.types';

export interface CreateReviewInput {
  booking_id?: string;
  bookingId?: string;
  rating: number;
  comment?: string;
}

export interface UpdateReviewInput {
  rating?: number;
  comment?: string;
}

export type ReviewResponseData = Review;
