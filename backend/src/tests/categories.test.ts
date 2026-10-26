import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { getDatabase, resetDatabase } from '../database/sqlite';
import { InMemoryUserRepository } from '../repositories/user.repo';

describe('Categories API (GET /categories)', () => {
  beforeEach(() => {
    resetDatabase();
    getDatabase(':memory:');
  });

  it('1. should fetch all available service categories successfully', async () => {
    const app = createApp(new InMemoryUserRepository());

    const res = await request(app).get('/categories');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Categories retrieved successfully');
    expect(res.body.data).toHaveProperty('categories');
    expect(Array.isArray(res.body.data.categories)).toBe(true);
    expect(res.body.data.categories.length).toBeGreaterThanOrEqual(1);

    const first = res.body.data.categories[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('slug');
  });

  it('2. should fetch categories under /api/categories alias as well', async () => {
    const app = createApp(new InMemoryUserRepository());

    const res = await request(app).get('/api/categories');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('3. should fetch a single category by valid ID', async () => {
    const app = createApp(new InMemoryUserRepository());

    const res = await request(app).get('/categories/cat_electrical');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('cat_electrical');
    expect(res.body.data.name).toBe('Electrical');
  });

  it('4. should return 404 for nonexistent category ID', async () => {
    const app = createApp(new InMemoryUserRepository());

    const res = await request(app).get('/categories/nonexistent_cat_id_123');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('not found');
  });
});
