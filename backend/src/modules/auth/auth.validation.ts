import { z } from 'zod';
import { MAX_PASSWORD_BYTES } from '../../utils/hash';

/**
 * Validation schema for the login request body.
 *
 * Rules:
 * 1. Email is trimmed and lowercased for uniform comparison.
 * 2. Password is strictly checked without trimming (preserving user-entered whitespace).
 * 3. Enforces 72-byte max limit to align with bcrypt's underlying truncation ceiling.
 * 4. Strict mode prevents unexpected or rogue fields.
 */
export const loginSchema = z
  .object({
    email: z
      .string({
        required_error: 'Email is required',
        invalid_type_error: 'Email must be a string',
      })
      .trim()
      .toLowerCase()
      .email('Please provide a valid email address')
      .max(255, 'Email cannot exceed 255 characters'),

    password: z
      .string({
        required_error: 'Password is required',
        invalid_type_error: 'Password must be a string',
      })
      .min(1, 'Password cannot be empty')
      .refine(
        (val) => Buffer.byteLength(val, 'utf8') <= MAX_PASSWORD_BYTES,
        `Password exceeds maximum allowed size of ${MAX_PASSWORD_BYTES} bytes`
      ),
  })
  .strict();

export type LoginSchemaType = z.infer<typeof loginSchema>;

/**
 * Validation schema for the registration request body.
 *
 * Rules:
 * 1. Email is trimmed, lowercased, and verified for valid format.
 * 2. Password requires at least 8 characters and maximum 72 bytes.
 * 3. Optional name field (1-100 characters).
 * 4. Strict mode prevents unexpected properties.
 */
export const registerSchema = z
  .object({
    email: z
      .string({
        required_error: 'Email is required',
        invalid_type_error: 'Email must be a string',
      })
      .trim()
      .toLowerCase()
      .email('Please provide a valid email address')
      .max(255, 'Email cannot exceed 255 characters'),

    password: z
      .string({
        required_error: 'Password is required',
        invalid_type_error: 'Password must be a string',
      })
      .min(8, 'Password must be at least 8 characters long')
      .refine(
        (val) => Buffer.byteLength(val, 'utf8') <= MAX_PASSWORD_BYTES,
        `Password exceeds maximum allowed size of ${MAX_PASSWORD_BYTES} bytes`
      ),

    name: z
      .string()
      .trim()
      .min(1, 'Name cannot be empty')
      .max(100, 'Name cannot exceed 100 characters')
      .optional(),

    phone: z
      .string()
      .trim()
      .min(5, 'Phone number too short')
      .max(20, 'Phone number cannot exceed 20 characters')
      .optional(),

    role: z
      .enum(['customer', 'worker', 'user'], {
        errorMap: () => ({ message: "Role must be 'customer' or 'worker'" }),
      })
      .optional(),
  })
  .strict();

export type RegisterSchemaType = z.infer<typeof registerSchema>;
