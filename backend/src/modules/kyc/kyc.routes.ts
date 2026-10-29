import { Router } from 'express';
import { authenticateToken, requireRole } from '../../middlewares/auth.middleware';
import { validateBody } from '../../middlewares/validate.middleware';
import { kycController, KycController } from './kyc.controller';
import { submitKycSchema } from './kyc.validation';

export function createKycRouter(controller: KycController = kycController): Router {
  const router = Router();

  // All KYC worker endpoints require worker authentication
  router.use(authenticateToken);
  router.use(requireRole('worker'));

  /**
   * API 26: POST /kyc/submit
   * Role: Worker
   */
  router.post('/submit', validateBody(submitKycSchema), controller.submit);

  /**
   * API 27: GET /kyc/status
   * Role: Worker
   */
  router.get('/status', controller.getStatus);

  return router;
}

export const kycRouter = createKycRouter();
