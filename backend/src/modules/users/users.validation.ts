import { z } from 'zod';
import { MAX_PASSWORD_BYTES } from '../../utils/hash';

export const updateUserProfileSchema = z
  .object({
    name: z.string().trim().min(1, 'Name cannot be empty').max(100).optional(),
    phone: z.string().trim().min(5, 'Phone number too short').max(20).optional(),
    avatar_url: z.string().trim().optional(),
    avatarUrl: z.string().trim().optional(),
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().optional(),
    current_password: z.string().optional(),
    newPassword: z.string().optional(),
    new_password: z.string().optional(),
  })
  .refine((data) => !!(data.currentPassword || data.current_password), {
    message: 'Current password is required',
  })
  .refine(
    (data) => {
      const pwd = data.newPassword || data.new_password;
      return !!pwd && pwd.length >= 8 && Buffer.byteLength(pwd, 'utf8') <= MAX_PASSWORD_BYTES;
    },
    {
      message: `New password must be between 8 characters and ${MAX_PASSWORD_BYTES} bytes`,
    }
  );
