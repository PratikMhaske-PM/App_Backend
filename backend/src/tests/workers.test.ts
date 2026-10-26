import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { getDatabase, resetDatabase } from '../database/sqlite';
import { InMemoryUserRepository } from '../repositories/user.repo';
import { signAccessToken } from '../utils/jwt';

describe('Workers API', () => {
  let app: ReturnType<typeof createApp>;
  let workerToken: string;
  let customerToken: string;

  beforeEach(() => {
    resetDatabase();
    getDatabase(':memory:');
    app = createApp(new InMemoryUserRepository());

    // Worker token for usr_worker_1
    workerToken = signAccessToken({
      userId: 'usr_worker_1',
      email: 'worker@example.com',
      role: 'worker',
      name: 'Alex Rodriguez',
    });

    // Customer token for usr_demo_1
    customerToken = signAccessToken({
      userId: 'usr_demo_1',
      email: 'user@example.com',
      role: 'customer',
      name: 'Demo Customer',
    });
  });

  describe('GET /workers', () => {
    it('1. should fetch workers with pagination structure', async () => {
      const res = await request(app).get('/workers?page=1&limit=10');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('workers');
      expect(res.body.data).toHaveProperty('pagination');
      expect(Array.isArray(res.body.data.workers)).toBe(true);
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.limit).toBe(10);
    });

    it('2. should filter workers by category_id', async () => {
      const res = await request(app).get('/workers?category_id=cat_electrical');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      for (const w of res.body.data.workers) {
        expect(w.categoryId).toBe('cat_electrical');
      }
    });

    it('3. should search workers by text query', async () => {
      const res = await request(app).get('/workers?search=Electrician');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.workers.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.workers[0].title).toContain('Electrician');
    });

    it('4. should sort workers by hourly_rate', async () => {
      const res = await request(app).get('/workers?sort_by=hourly_rate&order=asc');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /workers/:id', () => {
    it('5. should fetch worker details for valid worker ID', async () => {
      const res = await request(app).get('/workers/wrk_demo_1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('wrk_demo_1');
      expect(res.body.data.title).toBe('Master Electrician');
      expect(res.body.data).toHaveProperty('categoryName');
      expect(res.body.data).not.toHaveProperty('passwordHash');
    });

    it('6. should return 404 for invalid worker ID', async () => {
      const res = await request(app).get('/workers/invalid_worker_999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not found');
    });
  });

  describe('GET /workers/:id/reviews', () => {
    it('7. should fetch worker reviews list', async () => {
      const res = await request(app).get('/workers/wrk_demo_1/reviews');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('reviews');
      expect(res.body.data).toHaveProperty('pagination');
    });
  });

  describe('PATCH /workers/me/availability', () => {
    it('8. should allow authenticated worker to update availability', async () => {
      const res = await request(app)
        .patch('/workers/me/availability')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          is_available: false,
          availability_status: 'busy',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isAvailable).toBe(false);
      expect(res.body.data.availabilityStatus).toBe('busy');
    });

    it('9. should reject availability update without authentication token', async () => {
      const res = await request(app)
        .patch('/workers/me/availability')
        .send({ is_available: true });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('10. should forbid customer role from updating worker availability', async () => {
      const res = await request(app)
        .patch('/workers/me/availability')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ is_available: true });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /workers/me/stats', () => {
    it('11. should fetch statistics for authenticated worker', async () => {
      const res = await request(app)
        .get('/workers/me/stats')
        .set('Authorization', `Bearer ${workerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('totalBookings');
      expect(res.body.data).toHaveProperty('completedBookings');
      expect(res.body.data).toHaveProperty('totalEarnings');
      expect(res.body.data).toHaveProperty('averageRating');
    });

    it('12. should forbid customer from viewing worker stats', async () => {
      const res = await request(app)
        .get('/workers/me/stats')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Worker Profile Management (GET & PATCH /workers/me/profile)', () => {
    it('13. should fetch profile for authenticated worker', async () => {
      const res = await request(app)
        .get('/workers/me/profile')
        .set('Authorization', `Bearer ${workerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Master Electrician');
    });

    it('14. should update worker profile successfully', async () => {
      const res = await request(app)
        .patch('/workers/me/profile')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          title: 'Senior Master Electrician',
          hourly_rate: 75.0,
          location: 'Brooklyn, NY',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Senior Master Electrician');
      expect(res.body.data.hourlyRate).toBe(75.0);
      expect(res.body.data.location).toBe('Brooklyn, NY');
    });
  });
});
