import { z } from 'zod';

export const createSosSchema = z
  .object({
    emergency_type: z.string().trim().min(2, 'Emergency type is too short').max(50).optional(),
    emergencyType: z.string().trim().min(2, 'Emergency type is too short').max(50).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    booking_id: z.string().trim().optional(),
    bookingId: z.string().trim().optional(),
    notes: z.string().trim().max(500, 'Notes cannot exceed 500 characters').optional(),
  })
  .strict()
  .refine((data) => !!(data.emergency_type || data.emergencyType), {
    message: 'emergency_type is required (e.g. medical, security, accident, harassment, general)',
  });
