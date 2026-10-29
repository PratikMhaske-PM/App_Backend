import { Router } from 'express';
import { authenticateToken } from '../../middlewares/auth.middleware';
import { validateBody } from '../../middlewares/validate.middleware';
import { sosController, SosController } from './sos.controller';
import { createSosSchema } from './sos.validation';

export function createSosRouter(controller: SosController = sosController): Router {
  const router = Router();

  // All SOS requests require authentication
  router.use(authenticateToken);

  /**
   * API 29: POST /sos
   * Role: All authenticated users
   */
  router.post('/', validateBody(createSosSchema), controller.create);

  return router;
}

export const sosRouter = createSosRouter();
