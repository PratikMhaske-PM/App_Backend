import { Router } from 'express';
import { authenticateToken, requireRole } from '../../middlewares/auth.middleware';
import { validateBody, validateParams } from '../../middlewares/validate.middleware';
import { kycController, KycController } from './kyc.controller';
import { adminUpdateKycSchema, kycIdParamSchema, submitKycSchema } from './kyc.validation';

export function createKycRouter(controller: KycController = kycController): Router {
  const router = Router();

  /**
   * POST /kyc/submit
   * Workers only — submit KYC documents.
   */
  router.post(
    '/submit',
    authenticateToken,
    requireRole('worker'),
    validateBody(submitKycSchema),
    controller.submit
  );

  /**
   * GET /kyc/status
   * Workers only — get their own KYC submission status.
   */
  router.get(
    '/status',
    authenticateToken,
    requireRole('worker'),
    controller.getStatus
  );

  return router;
}

/**
 * Admin KYC routes — mounted separately under /admin.
 * PATCH /admin/kyc/:id
 */
export function createAdminKycRouter(controller: KycController = kycController): Router {
  const router = Router();

  router.patch(
    '/:id',
    validateParams(kycIdParamSchema),
    validateBody(adminUpdateKycSchema),
    controller.adminUpdate
  );

  return router;
}

export const kycRouter = createKycRouter();
export const adminKycRouter = createAdminKycRouter();
