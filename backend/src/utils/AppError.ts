/**
 * Custom application error class to distinguish operational errors from programmer errors.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errors?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    errors?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors;

    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, errors?: unknown): AppError {
    return new AppError(message, 400, true, errors);
  }

  static unauthorized(message: string = 'Unauthorized'): AppError {
    return new AppError(message, 401, true);
  }

  static forbidden(message: string = 'Forbidden'): AppError {
    return new AppError(message, 403, true);
  }

  static notFound(message: string = 'Resource not found'): AppError {
    return new AppError(message, 404, true);
  }

  static conflict(message: string = 'Conflict'): AppError {
    return new AppError(message, 409, true);
  }

  static tooManyRequests(message: string = 'Too many requests. Please try again later.'): AppError {
    return new AppError(message, 429, true);
  }

  static internal(message: string = 'Internal server error'): AppError {
    return new AppError(message, 500, false);
  }
}
