import { defaultCategoryRepository, ICategoryRepository } from '../../repositories/category.repo';
import { Category } from '../../types/common.types';
import { AppError } from '../../utils/AppError';
import { CategoryListResponseData } from './categories.types';

export class CategoriesService {
  constructor(private readonly categoryRepo: ICategoryRepository = defaultCategoryRepository) {}

  async getAllCategories(): Promise<CategoryListResponseData> {
    const categories = await this.categoryRepo.findAll();
    return {
      categories,
      total: categories.length,
    };
  }

  async getCategoryById(id: string): Promise<Category> {
    const category = await this.categoryRepo.findById(id);
    if (!category) {
      // Try finding by slug for flexible routing
      const bySlug = await this.categoryRepo.findBySlug(id);
      if (!bySlug) {
        throw AppError.notFound(`Category '${id}' not found`);
      }
      return bySlug;
    }
    return category;
  }
}

export const categoriesService = new CategoriesService();
