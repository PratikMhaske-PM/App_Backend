import { z } from 'zod';

export const workerListQuerySchema = z.object({
  category_id: z.string().trim().optional(),
  categoryId: z.string().trim().optional(),
  search: z.string().trim().max(100, 'Search term too long').optional(),
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
  sort_by: z
    .enum(['rating', 'hourly_rate', 'experience_years', 'created_at'])
    .optional()
    .default('rating'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type WorkerListQuery = z.infer<typeof workerListQuerySchema>;

export const workerIdParamSchema = z.object({
  id: z.string().trim().min(1, 'Worker ID is required'),
});

export const workerReviewsQuerySchema = z.object({
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

export const updateAvailabilitySchema = z
  .object({
    is_available: z.boolean().optional(),
    isAvailable: z.boolean().optional(),
    availability_status: z.enum(['available', 'busy', 'offline']).optional(),
    availabilityStatus: z.enum(['available', 'busy', 'offline']).optional(),
  })
  .refine(
    (data) =>
      data.is_available !== undefined ||
      data.isAvailable !== undefined ||
      data.availability_status !== undefined ||
      data.availabilityStatus !== undefined,
    {
      message: 'At least one availability field must be provided',
    }
  );

export const updateWorkerProfileSchema = z.object({
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(100).optional(),
  bio: z.string().trim().max(1000, 'Bio cannot exceed 1000 characters').optional(),
  hourly_rate: z.number().min(0, 'Hourly rate cannot be negative').optional(),
  hourlyRate: z.number().min(0, 'Hourly rate cannot be negative').optional(),
  experience_years: z.number().int().min(0, 'Experience years must be positive').optional(),
  experienceYears: z.number().int().min(0, 'Experience years must be positive').optional(),
  category_id: z.string().trim().optional(),
  categoryId: z.string().trim().optional(),
  location: z.string().trim().max(100).optional(),
});
