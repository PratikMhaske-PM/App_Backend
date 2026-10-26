import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { getDatabase, resetDatabase } from '../database/sqlite';
import { InMemoryUserRepository } from '../repositories/user.repo';
import { signAccessToken } from '../utils/jwt';

describe('Users & Admin API', () => {
  let app: ReturnType<typeof createApp>;
  let customerToken: string;
  let adminToken: string;

  beforeEach(() => {
    resetDatabase();
    getDatabase(':memory:');
    app = createApp(new InMemoryUserRepository());

    customerToken = signAccessToken({
      userId: 'usr_demo_1',
      email: 'user@example.com',
      role: 'customer',
      name: 'Demo Customer',
    });

    adminToken = signAccessToken({
      userId: 'usr_admin_1',
      email: 'admin@example.com',
      role: 'admin',
      name: 'System Admin',
    });
  });

  describe('User Profile Management (GET & PATCH /users/me)', () => {
    it('1. should fetch profile for authenticated user without exposing passwordHash', async () => {
      const res = await request(app)
        .get('/users/me')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('email');
      expect(res.body.data).not.toHaveProperty('passwordHash');
    });

    it('2. should update user profile name and phone', async () => {
      const res = await request(app)
        .patch('/users/me')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Updated Customer Name',
          phone: '+1-555-0999',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Customer Name');
      expect(res.body.data.phone).toBe('+1-555-0999');
    });

    it('3. should reject privilege escalation attempts (cannot set role in profile)', async () => {
      const res = await request(app)
        .patch('/users/me')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Hacker',
          role: 'admin',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('4. should change password successfully when current password matches', async () => {
      const res = await request(app)
        .patch('/users/me/password')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          current_password: 'Password123!',
          new_password: 'BrandNewSecurePassword123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Password updated successfully');
    });

    it('5. should reject password change when current password is wrong', async () => {
      const res = await request(app)
        .patch('/users/me/password')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          current_password: 'WrongCurrentPassword!',
          new_password: 'BrandNewSecurePassword123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('incorrect');
    });
  });

  describe('Admin Management & Worker Verification', () => {
    it('6. should allow admin to view all workers across verification statuses', async () => {
      const res = await request(app)
        .get('/admin/workers')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('workers');
      expect(res.body.data).toHaveProperty('total');
    });

    it('7. should forbid non-admin users from accessing /admin/workers', async () => {
      const res = await request(app)
        .get('/admin/workers')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('8. should allow admin to update worker verification status', async () => {
      const res = await request(app)
        .patch('/admin/workers/wrk_demo_1/verify')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'approved' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.verificationStatus).toBe('approved');
    });

    it('9. should allow admin to retrieve platform system stats', async () => {
      const res = await request(app)
        .get('/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('totalUsers');
      expect(res.body.data).toHaveProperty('totalWorkers');
      expect(res.body.data).toHaveProperty('totalBookings');
    });
  });
});
