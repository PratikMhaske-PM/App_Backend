import { Router } from 'express';
import { authenticateToken, requireRole } from '../../middlewares/auth.middleware';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../middlewares/validate.middleware';
import { jobsController, JobsController } from './jobs.controller';
import {
  jobIdParamSchema,
  jobListQuerySchema,
  updateJobStatusSchema,
} from './jobs.validation';

export function createJobsRouter(controller: JobsController = jobsController): Router {
  const router = Router();

  // All jobs endpoints require worker authentication
  router.use(authenticateToken);
  router.use(requireRole('worker'));

  /**
   * API 14: GET /jobs/requests
   * Role: worker
   * Retrieve service requests the authenticated worker is permitted to view.
   */
  router.get('/requests', validateQuery(jobListQuerySchema), controller.getRequests);

  /**
   * API 15: GET /jobs/me
   * Role: worker
   * Retrieve the authenticated worker's activities and job history.
   */
  router.get('/me', validateQuery(jobListQuerySchema), controller.getMyJobs);

  /**
   * API 17: PATCH /jobs/:id/status
   * Role: worker
   * Update the status of an authorized job.
   */
  router.patch(
    '/:id/status',
    validateParams(jobIdParamSchema),
    validateBody(updateJobStatusSchema),
    controller.updateStatus
  );

  /**
   * API 16: GET /jobs/:id
   * Role: worker
   * Retrieve details of a specific job.
   */
  router.get('/:id', validateParams(jobIdParamSchema), controller.getById);

  return router;
}

export const jobsRouter = createJobsRouter();
