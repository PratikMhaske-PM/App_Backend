import { Router } from 'express';
import { authenticateToken, requireRole } from '../../middlewares/auth.middleware';
import { validateBody, validateParams } from '../../middlewares/validate.middleware';
import { adminController, AdminController } from './admin.controller';
import { adminWorkerIdParamSchema, verifyWorkerSchema } from './admin.validation';

export function createAdminRouter(controller: AdminController = adminController): Router {
  const router = Router();

  // Enforce authentication and administrative privilege for all routes
  router.use(authenticateToken);
  router.use(requireRole('admin'));

  /**
   * GET /admin/workers
   * Fetch all workers for verification review.
   */
  router.get('/workers', controller.getAllWorkers);

  /**
   * PATCH /admin/workers/:id/verify
   * Update worker verification status.
   */
  router.patch(
    '/workers/:id/verify',
    validateParams(adminWorkerIdParamSchema),
    validateBody(verifyWorkerSchema),
    controller.verifyWorker
  );

  /**
   * GET /admin/stats
   * Fetch system-wide platform statistics.
   */
  router.get('/stats', controller.getSystemStats);

  return router;
}

export const adminRouter = createAdminRouter();
