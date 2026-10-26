import { db } from '../config/database';
import { IDatabase } from '../database/sqlite';
import { Category } from '../types/common.types';

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

function mapCategoryRow(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description || undefined,
    icon: row.icon || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ICategoryRepository {
  findAll(): Promise<Category[]>;
  findById(id: string): Promise<Category | null>;
  findBySlug(slug: string): Promise<Category | null>;
}

export class CategoryRepository implements ICategoryRepository {
  constructor(private readonly database: IDatabase = db) {}

  async findAll(): Promise<Category[]> {
    const rows = this.database.query<CategoryRow>(
      'SELECT id, name, slug, description, icon, created_at, updated_at FROM categories ORDER BY name ASC'
    );
    return rows.map(mapCategoryRow);
  }

  async findById(id: string): Promise<Category | null> {
    const row = this.database.queryOne<CategoryRow>(
      'SELECT id, name, slug, description, icon, created_at, updated_at FROM categories WHERE id = ?',
      [id]
    );
    return row ? mapCategoryRow(row) : null;
  }

  async findBySlug(slug: string): Promise<Category | null> {
    const row = this.database.queryOne<CategoryRow>(
      'SELECT id, name, slug, description, icon, created_at, updated_at FROM categories WHERE slug = ?',
      [slug.toLowerCase()]
    );
    return row ? mapCategoryRow(row) : null;
  }
}

export const defaultCategoryRepository: ICategoryRepository = new CategoryRepository();
