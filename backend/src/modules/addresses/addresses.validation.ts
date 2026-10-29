import { z } from 'zod';

export const createAddressSchema = z
  .object({
    label: z.string().trim().max(50, 'Label cannot exceed 50 characters').optional(),
    street: z
      .string({ required_error: 'Street address is required' })
      .trim()
      .min(3, 'Street address must be at least 3 characters')
      .max(200, 'Street address cannot exceed 200 characters'),
    city: z
      .string({ required_error: 'City is required' })
      .trim()
      .min(2, 'City must be at least 2 characters')
      .max(100, 'City cannot exceed 100 characters'),
    state: z.string().trim().max(100, 'State cannot exceed 100 characters').optional(),
    postal_code: z.string().trim().max(20, 'Postal code cannot exceed 20 characters').optional(),
    postalCode: z.string().trim().max(20, 'Postal code cannot exceed 20 characters').optional(),
    country: z.string().trim().max(100, 'Country cannot exceed 100 characters').optional(),
    is_default: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  })
  .strict();

export const updateAddressSchema = z
  .object({
    label: z.string().trim().max(50, 'Label cannot exceed 50 characters').optional(),
    street: z
      .string()
      .trim()
      .min(3, 'Street address must be at least 3 characters')
      .max(200, 'Street address cannot exceed 200 characters')
      .optional(),
    city: z
      .string()
      .trim()
      .min(2, 'City must be at least 2 characters')
      .max(100, 'City cannot exceed 100 characters')
      .optional(),
    state: z.string().trim().max(100, 'State cannot exceed 100 characters').optional(),
    postal_code: z.string().trim().max(20, 'Postal code cannot exceed 20 characters').optional(),
    postalCode: z.string().trim().max(20, 'Postal code cannot exceed 20 characters').optional(),
    country: z.string().trim().max(100, 'Country cannot exceed 100 characters').optional(),
    is_default: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const addressIdParamSchema = z.object({
  id: z.string().trim().min(1, 'Address ID is required'),
});

export const addressPaginationQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .refine((val) => !isNaN(val) && val >= 1, 'Page must be >= 1'),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .refine((val) => !isNaN(val) && val >= 1 && val <= 50, 'Limit must be between 1 and 50'),
});
