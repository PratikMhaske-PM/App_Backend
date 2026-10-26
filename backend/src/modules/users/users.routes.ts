import { Router } from 'express';
import { authenticateToken } from '../../middlewares/auth.middleware';
import { validateBody } from '../../middlewares/validate.middleware';
import { usersController, UsersController } from './users.controller';
import { changePasswordSchema, updateUserProfileSchema } from './users.validation';

export function createUsersRouter(controller: UsersController = usersController): Router {
  const router = Router();

  router.use(authenticateToken);

  /**
   * GET /users/me
   * Fetch current user profile.
   */
  router.get('/me', controller.getProfile);

  /**
   * PATCH /users/me
   * Update current user profile.
   */
  router.patch('/me', validateBody(updateUserProfileSchema), controller.updateProfile);

  /**
   * PATCH /users/me/password
   * Change password.
   */
  router.patch(
    '/me/password',
    validateBody(changePasswordSchema),
    controller.changePassword
  );

  return router;
}

export const usersRouter = createUsersRouter();
