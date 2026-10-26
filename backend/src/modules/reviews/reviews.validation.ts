import { z } from 'zod';

export const createReviewSchema = z
  .object({
    booking_id: z.string().trim().optional(),
    bookingId: z.string().trim().optional(),
    rating: z
      .number({
        required_error: 'Rating is required',
        invalid_type_error: 'Rating must be a number',
      })
      .int('Rating must be an integer')
      .min(1, 'Rating must be between 1 and 5')
      .max(5, 'Rating must be between 1 and 5'),
    comment: z.string().trim().max(1000, 'Comment cannot exceed 1000 characters').optional(),
  })
  .refine((data) => !!(data.booking_id || data.bookingId), {
    message: 'Booking ID is required (booking_id or bookingId)',
  });

export const updateReviewSchema = z.object({
  rating: z
    .number()
    .int('Rating must be an integer')
    .min(1, 'Rating must be between 1 and 5')
    .max(5, 'Rating must be between 1 and 5')
    .optional(),
  comment: z.string().trim().max(1000, 'Comment cannot exceed 1000 characters').optional(),
});

export const reviewIdParamSchema = z.object({
  id: z.string().trim().min(1, 'Review ID is required'),
});
