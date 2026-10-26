import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

/**
 * Centralized error handling middleware.
 * Ensures all errors result in a consistent JSON response envelope.
 * Shields internal system details and stack traces from production clients.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isProduction = env.NODE_ENV === 'production';

  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error({
        message: err.message,
        path: req.originalUrl,
        method: req.method,
        stack: err.stack,
      }, 'Non-operational AppError occurred');
    }

    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.errors !== undefined && { errors: err.errors }),
      ...(!isProduction && { stack: err.stack }),
    });
    return;
  }

  // Handle syntax error from malformed JSON bodies
  if (err instanceof SyntaxError && 'status' in err && (err as { status: number }).status === 400) {
    res.status(400).json({
      success: false,
      message: 'Malformed JSON payload in request body',
    });
    return;
  }

  // Unhandled / unexpected programmer errors
  const standardError = err instanceof Error ? err : new Error(String(err));

  logger.error(
    {
      message: standardError.message,
      stack: standardError.stack,
      path: req.originalUrl,
      method: req.method,
    },
    'Unhandled server exception'
  );

  res.status(500).json({
    success: false,
    message: isProduction ? 'Internal server error' : standardError.message,
    ...(!isProduction && { stack: standardError.stack }),
  });
}
