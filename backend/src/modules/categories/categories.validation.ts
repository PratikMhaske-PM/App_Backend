import { z } from 'zod';

export const getCategoryByIdParamsSchema = z.object({
  id: z.string().trim().min(1, 'Category ID is required'),
});

export type GetCategoryByIdParams = z.infer<typeof getCategoryByIdParamsSchema>;
