import { z } from 'zod';

export const createAddressSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, 'Label cannot be empty')
    .max(50, 'Label cannot exceed 50 characters')
    .optional()
    .default('Home'),
  street: z.string().trim().min(2, 'Street is required').max(200),
  city: z.string().trim().min(1, 'City is required').max(100),
  state: z.string().trim().max(100).optional(),
  postal_code: z.string().trim().max(20).optional(),
  postalCode: z.string().trim().max(20).optional(),
  country: z.string().trim().max(100).optional().default('IN'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  is_default: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

export const updateAddressSchema = z
  .object({
    label: z.string().trim().min(1).max(50).optional(),
    street: z.string().trim().min(2).max(200).optional(),
    city: z.string().trim().min(1).max(100).optional(),
    state: z.string().trim().max(100).optional(),
    postal_code: z.string().trim().max(20).optional(),
    postalCode: z.string().trim().max(20).optional(),
    country: z.string().trim().max(100).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    is_default: z.boolean().optional(),
    isDefault: z.boolean().optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: 'At least one field must be provided for update' }
  );

export const addressIdParamSchema = z.object({
  id: z.string().trim().min(1, 'Address ID is required'),
});

export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
