import jwt, { JwtPayload, SignOptions, VerifyOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { AccessTokenClaims, AuthUserPayload } from '../modules/auth/auth.types';
import { AppError } from './AppError';

/**
 * ARCHITECTURAL NOTES & TOKEN TRANSPORT TRADE-OFFS:
 *
 * 1. Bearer Token in HTTP Authorization Header:
 *    - Pros:
 *      * Stateless and decoupled from browser cookie restrictions.
 *      * Resistant to Cross-Site Request Forgery (CSRF) by default because browsers do not
 *        automatically attach Authorization headers on cross-origin requests.
 *      * Works seamlessly with mobile apps, single-page applications, and microservices.
 *    - Cons:
 *      * If stored in browser localStorage or sessionStorage, it is susceptible to Cross-Site Scripting (XSS).
 *      * If stored in memory (React state), tokens are cleared on page reload unless refreshed.
 *    - Best practice: Keep token lifetime short (15m) and combine with secure, httpOnly cookies
 *      for long-lived refresh tokens if session persistence across reloads is required.
 *
 * 2. URL & Logging Security:
 *    - JWTs must NEVER be transmitted in URL query strings (risk of leaking in browser history,
 *      server access logs, and referrer headers).
 *    - JWTs must NEVER be logged in plaintext.
 *
 * 3. Revocation:
 *    - Pure JWT access tokens are stateless and cannot be individually revoked before expiration
 *      without maintaining a shared blacklist/denylist (e.g. in Redis).
 */

const ALGORITHM = 'HS256';

/**
 * Signs a short-lived access token with strict claims.
 */
export function signAccessToken(claims: {
  userId: string;
  email: string;
  role: string;
  name?: string;
}): string {
  const payload: AccessTokenClaims = {
    sub: claims.userId,
    email: claims.email,
    role: claims.role,
    ...(claims.name && { name: claims.name }),
  };

  const options: SignOptions = {
    algorithm: ALGORITHM,
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  };

  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

/**
 * Verifies a JWT access token against the configured secret, issuer, audience, and algorithm.
 * Throws AppError.unauthorized if the token is invalid or expired.
 */
export function verifyAccessToken(token: string): AuthUserPayload {
  const verifyOptions: VerifyOptions = {
    algorithms: [ALGORITHM],
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    complete: false,
  };

  try {
    const decoded = jwt.verify(
      token,
      env.JWT_ACCESS_SECRET,
      verifyOptions
    ) as JwtPayload;

    if (!decoded || typeof decoded !== 'object' || !decoded.sub) {
      throw AppError.unauthorized('Invalid token payload structure');
    }

    return {
      userId: decoded.sub as string,
      email: (decoded['email'] as string) || '',
      role: (decoded['role'] as string) || 'user',
      name: decoded['name'] as string | undefined,
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw AppError.unauthorized('Token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw AppError.unauthorized('Invalid token signature or format');
    }
    if (error instanceof AppError) {
      throw error;
    }
    throw AppError.unauthorized('Authentication failed');
  }
}
