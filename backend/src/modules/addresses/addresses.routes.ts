import { Router } from 'express';
import { authenticateToken } from '../../middlewares/auth.middleware';
import { validateBody, validateParams } from '../../middlewares/validate.middleware';
import { addressesController, AddressesController } from './addresses.controller';
import {
  addressIdParamSchema,
  createAddressSchema,
  updateAddressSchema,
} from './addresses.validation';

export function createAddressesRouter(controller: AddressesController = addressesController): Router {
  const router = Router();

  // All address routes require authentication
  router.use(authenticateToken);

  /**
   * GET /addresses
   * List all addresses for the authenticated user.
   */
  router.get('/', controller.getAddresses);

  /**
   * POST /addresses
   * Create a new address.
   */
  router.post('/', validateBody(createAddressSchema), controller.createAddress);

  /**
   * PATCH /addresses/:id
   * Update an owned address.
   */
  router.patch(
    '/:id',
    validateParams(addressIdParamSchema),
    validateBody(updateAddressSchema),
    controller.updateAddress
  );

  /**
   * DELETE /addresses/:id
   * Delete an owned address.
   */
  router.delete(
    '/:id',
    validateParams(addressIdParamSchema),
    controller.deleteAddress
  );

  return router;
}

export const addressesRouter = createAddressesRouter();
