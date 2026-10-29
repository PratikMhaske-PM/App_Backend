import { z } from 'zod';

export const jobListQuerySchema = z.object({
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

export const jobIdParamSchema = z.object({
  id: z.string().trim().min(1, 'Job ID is required'),
});

export const updateJobStatusSchema = z.object({
  status: z
    .string({ required_error: 'Status is required' })
    .trim()
    .min(1, 'Status cannot be empty')
    .refine(
      (val) =>
        [
          'accepted',
          'confirmed',
          'in_progress',
          'completed',
          'cancelled',
          'rejected',
        ].includes(val.toLowerCase()),
      {
        message:
          'Status must be one of: accepted, confirmed, in_progress, completed, cancelled, rejected',
      }
    ),
  note: z.string().trim().max(500, 'Note cannot exceed 500 characters').optional(),
});
