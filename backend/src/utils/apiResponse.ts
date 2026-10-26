import { Response } from 'express';
import { ApiResponse } from '../types/common.types';

/**
 * Sends a standardized success JSON response.
 */
export function sendSuccess<T>(
  res: Response,
  statusCode: number,
  message: string,
  data?: T
): Response {
  const responseBody: ApiResponse<T> = {
    success: true,
    message,
    ...(data !== undefined && { data }),
  };
  return res.status(statusCode).json(responseBody);
}

/**
 * Sends a standardized error JSON response.
 */
export function sendError(
  res: Response,
  statusCode: number,
  message: string,
  errors?: unknown
): Response {
  const responseBody: ApiResponse = {
    success: false,
    message,
    ...(errors !== undefined && { errors }),
  };
  return res.status(statusCode).json(responseBody);
}
