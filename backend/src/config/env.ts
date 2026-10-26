import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  PORT: z
    .string()
    .default('5000')
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val > 0 && val <= 65535, {
      message: 'PORT must be a valid port number between 1 and 65535',
    }),

  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  FRONTEND_URL: z
    .string()
    .optional()
    .default('http://localhost:3000'),

  JWT_ACCESS_SECRET: z
    .string({
      required_error: 'JWT_ACCESS_SECRET is required',
    })
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters long for cryptographic security'),

  JWT_ACCESS_EXPIRES_IN: z
    .string()
    .default('15m'),

  JWT_ISSUER: z
    .string()
    .default('my-backend'),

  JWT_AUDIENCE: z
    .string()
    .default('my-frontend'),

  BCRYPT_ROUNDS: z
    .string()
    .default('12')
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val) && val >= 10 && val <= 16, {
      message: 'BCRYPT_ROUNDS must be an integer between 10 and 16',
    }),

  DATABASE_PATH: z
    .string()
    .default('database.sqlite'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment variable configuration:');
  const issues = parsed.error.format();
  for (const [key, value] of Object.entries(issues)) {
    if (key !== '_errors' && value && '_errors' in value) {
      // eslint-disable-next-line no-console
      console.error(`  - ${key}: ${(value._errors as string[]).join(', ')}`);
    }
  }
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
