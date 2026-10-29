import { Router } from 'express';
import { authenticateToken } from '../../middlewares/auth.middleware';
import { validateQuery } from '../../middlewares/validate.middleware';
import { notificationsController, NotificationsController } from './notifications.controller';
import { notificationListQuerySchema } from './notifications.validation';

export function createNotificationsRouter(
  controller: NotificationsController = notificationsController
): Router {
  const router = Router();

  // All notification endpoints require authentication
  router.use(authenticateToken);

  /**
   * API 30: GET /notifications
   * Role: All authenticated users
   */
  router.get('/', validateQuery(notificationListQuerySchema), controller.getAll);

  return router;
}

export const notificationsRouter = createNotificationsRouter();
