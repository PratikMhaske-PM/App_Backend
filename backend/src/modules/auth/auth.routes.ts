import { Router } from 'express';
import { authenticateToken } from '../../middlewares/auth.middleware';
import { createLoginRateLimiter } from '../../middlewares/rateLimit.middleware';
import { validateBody } from '../../middlewares/validate.middleware';
import { authController, AuthController } from './auth.controller';
import { loginSchema, registerSchema } from './auth.validation';

/**
 * Creates and configures authentication router.
 */
export function createAuthRouter(
  controller: AuthController = authController,
  limiter = createLoginRateLimiter()
): Router {
  const router = Router();

  /**
   * POST /api/auth/register
   * Public endpoint to register a new user account.
   */
  router.post(
    '/register',
    limiter,
    validateBody(registerSchema),
    controller.register
  );

  /**
   * POST /api/auth/login
   * Public endpoint with dedicated rate limiter and input validation.
   */
  router.post(
    '/login',
    limiter,
    validateBody(loginSchema),
    controller.login
  );

  /**
   * GET /api/auth/me
   * Protected endpoint requiring a valid JWT access token.
   */
  router.get('/me', authenticateToken, controller.me);

  return router;
}

export const authRouter = createAuthRouter();
