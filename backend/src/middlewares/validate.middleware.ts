import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodTypeAny } from 'zod';
import { AppError } from '../utils/AppError';

/**
 * Middleware factory for validating incoming request bodies using Zod schemas.
 * Sanitized/parsed data is assigned back to req.body.
 */
export function validateBody(schema: ZodTypeAny) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync(req.body);
      req.body = parsed;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        next(AppError.badRequest('Validation failed', formattedErrors));
      } else {
        next(error);
      }
    }
  };
}

/**
 * Middleware factory for validating incoming request query parameters using Zod schemas.
 * Parsed and coerced values are assigned back to req.query.
 */
export function validateQuery(schema: ZodTypeAny) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync(req.query);
      req.query = parsed as Record<string, string>;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        next(AppError.badRequest('Query validation failed', formattedErrors));
      } else {
        next(error);
      }
    }
  };
}

/**
 * Middleware factory for validating route parameters (e.g. :id).
 */
export function validateParams(schema: ZodTypeAny) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = await schema.parseAsync(req.params);
      req.params = parsed as Record<string, string>;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        next(AppError.badRequest('URL parameter validation failed', formattedErrors));
      } else {
        next(error);
      }
    }
  };
}
