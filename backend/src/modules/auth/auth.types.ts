/**
 * Input DTO for user login.
 */
export interface LoginInput {
  email: string;
  password: string;
}

/**
 * Input DTO for user registration.
 */
export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
  phone?: string;
  role?: string;
}

/**
 * Authenticated user information attached to request or returned in tokens.
 */
export interface AuthUserPayload {
  userId: string;
  email: string;
  role: string;
  name?: string;
}

/**
 * JWT payload claims structure.
 */
export interface AccessTokenClaims {
  sub: string;
  email: string;
  role: string;
  name?: string;
}

/**
 * Successful login response data.
 * Notice: Sensitive fields like password and passwordHash are NEVER returned.
 */
export interface LoginResponseData {
  accessToken: string;
  tokenType: string;
  expiresIn: string;
  user: {
    id: string;
    email: string;
    role: string;
    name?: string;
  };
}

/**
 * Successful registration response data.
 */
export type RegisterResponseData = LoginResponseData;
