import { z } from 'zod';

export const createBookingSchema = z
  .object({
    worker_id: z.string().trim().optional(),
    workerId: z.string().trim().optional(),
    category_id: z.string().trim().optional(),
    categoryId: z.string().trim().optional(),
    service_description: z.string().trim().max(1000, 'Service description too long').optional(),
    serviceDescription: z.string().trim().max(1000, 'Service description too long').optional(),
    booking_date: z.string().trim().optional(),
    bookingDate: z.string().trim().optional(),
    booking_time: z
      .string()
      .trim()
      .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, 'Invalid time format (expected HH:MM)')
      .optional(),
    bookingTime: z
      .string()
      .trim()
      .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/, 'Invalid time format (expected HH:MM)')
      .optional(),
    address: z.string().trim().min(5, 'Address must be at least 5 characters').max(255),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    notes: z.string().trim().max(500, 'Notes cannot exceed 500 characters').optional(),
    total_price: z.number().min(0, 'Total price cannot be negative').optional(),
    totalPrice: z.number().min(0, 'Total price cannot be negative').optional(),
  })
  .refine((data) => !!(data.worker_id || data.workerId), {
    message: 'worker_id is required',
  })
  .refine((data) => !!(data.category_id || data.categoryId), {
    message: 'category_id is required',
  })
  .refine((data) => !!(data.booking_date || data.bookingDate), {
    message: 'booking_date is required',
  });

export const getMyBookingsQuerySchema = z.object({
  status: z.string().trim().optional(),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => !isNaN(val) && val >= 1, 'Page must be an integer >= 1'),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .refine((val) => !isNaN(val) && val >= 1 && val <= 50, 'Limit must be between 1 and 50'),
});

export const bookingIdParamSchema = z.object({
  id: z.string().trim().min(1, 'Booking ID is required'),
});

export const cancelBookingSchema = z.object({
  cancellation_reason: z.string().trim().max(255).optional(),
  cancellationReason: z.string().trim().max(255).optional(),
});
