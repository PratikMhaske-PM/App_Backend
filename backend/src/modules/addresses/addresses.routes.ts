import { Router } from 'express';
import { authenticateToken } from '../../middlewares/auth.middleware';
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../middlewares/validate.middleware';
import { addressesController, AddressesController } from './addresses.controller';
import {
  addressIdParamSchema,
  addressPaginationQuerySchema,
  createAddressSchema,
  updateAddressSchema,
} from './addresses.validation';

export function createAddressesRouter(controller: AddressesController = addressesController): Router {
  const router = Router();

  // All address operations require authentication
  router.use(authenticateToken);

  /**
   * API 22: GET /addresses
   * Role: All authenticated users
   */
  router.get('/', validateQuery(addressPaginationQuerySchema), controller.getAll);

  /**
   * API 23: POST /addresses
   * Role: All authenticated users
   */
  router.post('/', validateBody(createAddressSchema), controller.create);

  /**
   * API 24: PATCH /addresses/:id
   * Role: All authenticated users
   */
  router.patch(
    '/:id',
    validateParams(addressIdParamSchema),
    validateBody(updateAddressSchema),
    controller.update
  );

  /**
   * API 25: DELETE /addresses/:id
   * Role: All authenticated users
   */
  router.delete('/:id', validateParams(addressIdParamSchema), controller.delete);

  return router;
}

export const addressesRouter = createAddressesRouter();
