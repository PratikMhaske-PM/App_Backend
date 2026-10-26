import { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../../utils/apiResponse';
import { categoriesService, CategoriesService } from './categories.service';

export class CategoriesController {
  constructor(private readonly service: CategoriesService = categoriesService) {}

  /**
   * GET /categories
   * Fetch available service categories.
   */
  getAll = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getAllCategories();
      sendSuccess(res, 200, 'Categories retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /categories/:id
   * Fetch a single category by ID or slug.
   */
  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service.getCategoryById(req.params['id'] as string);
      sendSuccess(res, 200, 'Category details retrieved successfully', result);
    } catch (err) {
      next(err);
    }
  };
}

export const categoriesController = new CategoriesController();
