import bcrypt from 'bcrypt';
import { env } from '../config/env';
import { AppError } from './AppError';

/**
 * Bcrypt limitation: The underlying Blowfish cipher truncates input at 72 bytes.
 * Passwords longer than 72 bytes can lead to denial-of-service or unintended collisions.
 * We strictly enforce a 72-byte upper limit and reject oversized passwords before processing.
 */
export const MAX_PASSWORD_BYTES = 72;

/**
 * Hashes a plaintext password using bcrypt with configurable work factor rounds.
 * Note: Never log or store the plaintext password.
 * Do not trim passwords as whitespace may be part of the user's intended password.
 */
export async function hashPassword(
  password: string,
  rounds: number = env.BCRYPT_ROUNDS
): Promise<string> {
  const byteLength = Buffer.byteLength(password, 'utf8');
  if (byteLength > MAX_PASSWORD_BYTES) {
    throw AppError.badRequest(
      `Password exceeds maximum allowed size of ${MAX_PASSWORD_BYTES} bytes`
    );
  }

  return bcrypt.hash(password, rounds);
}

/**
 * Compares a plaintext password against a stored bcrypt hash.
 * Returns false if the input exceeds the maximum byte limit without throwing,
 * maintaining constant-time behavior where appropriate.
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  const byteLength = Buffer.byteLength(password, 'utf8');
  if (byteLength > MAX_PASSWORD_BYTES) {
    return false;
  }

  return bcrypt.compare(password, hash);
}
