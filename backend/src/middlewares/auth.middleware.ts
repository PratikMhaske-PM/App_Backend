/// <reference path="../types/express.d.ts" />
import { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';
import { verifyAccessToken } from '../utils/jwt';

/**
 * Authentication middleware.
 * Verifies the JWT Bearer token supplied in the Authorization header.
 * Attaches the decoded user payload to req.user.
 */
export function authenticateToken(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next(AppError.unauthorized('Authentication token is required'));
  }

  // Format must strictly match: Bearer <token>
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return next(
      AppError.unauthorized('Malformed authorization header. Expected "Bearer <token>"')
    );
  }

  const token = parts[1];
  if (!token) {
    return next(AppError.unauthorized('Authentication token is missing'));
  }

  try {
    const userPayload = verifyAccessToken(token);
    req.user = userPayload;
    return next();
  } catch (err) {
    return next(err);
  }
}

/**
 * Authorization middleware.
 * Verifies that the authenticated user possesses one of the allowed roles.
 * Must be mounted AFTER authenticateToken middleware.
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required before role verification'));
    }

    const effectiveAllowed = allowedRoles.flatMap((role) =>
      role === 'customer' || role === 'user' ? ['customer', 'user'] : [role]
    );

    if (!effectiveAllowed.includes(req.user.role)) {
      return next(
        AppError.forbidden('You do not have permission to access this resource')
      );
    }

    return next();
  };
}
