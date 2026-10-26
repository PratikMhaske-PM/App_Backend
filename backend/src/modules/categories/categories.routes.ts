import { Router } from 'express';
import { validateParams } from '../../middlewares/validate.middleware';
import { categoriesController, CategoriesController } from './categories.controller';
import { getCategoryByIdParamsSchema } from './categories.validation';

export function createCategoriesRouter(
  controller: CategoriesController = categoriesController
): Router {
  const router = Router();

  /**
   * GET /categories
   * Fetch available service categories.
   */
  router.get('/', controller.getAll);

  /**
   * GET /categories/:id
   * Fetch a single category by ID.
   */
  router.get('/:id', validateParams(getCategoryByIdParamsSchema), controller.getById);

  return router;
}

export const categoriesRouter = createCategoriesRouter();
