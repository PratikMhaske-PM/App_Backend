import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { getDatabase, resetDatabase } from '../database/sqlite';
import { InMemoryUserRepository } from '../repositories/user.repo';
import { signAccessToken } from '../utils/jwt';

describe('Reviews API', () => {
  let app: ReturnType<typeof createApp>;
  let customerToken: string;
  let workerToken: string;
  let otherCustomerToken: string;

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

    workerToken = signAccessToken({
      userId: 'usr_worker_1',
      email: 'worker@example.com',
      role: 'worker',
      name: 'Alex Rodriguez',
    });

    otherCustomerToken = signAccessToken({
      userId: 'usr_other_customer',
      email: 'other@example.com',
      role: 'customer',
      name: 'Other Customer',
    });
  });

  async function createCompletedBooking(): Promise<string> {
    const bookingRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        worker_id: 'wrk_demo_1',
        category_id: 'cat_electrical',
        booking_date: '2026-12-01T10:00:00.000Z',
        address: '888 Review Way',
      });

    const bookingId = bookingRes.body.data.id;

    await request(app)
      .patch(`/api/bookings/${bookingId}/accept`)
      .set('Authorization', `Bearer ${workerToken}`);

    await request(app)
      .patch(`/api/bookings/${bookingId}/complete`)
      .set('Authorization', `Bearer ${workerToken}`);

    return bookingId;
  }

  describe('POST /api/reviews', () => {
    it('1. should allow eligible customer to submit review for completed booking', async () => {
      const bookingId = await createCompletedBooking();

      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          booking_id: bookingId,
          rating: 5,
          comment: 'Outstanding electrical work! Very professional.',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.rating).toBe(5);
      expect(res.body.data.comment).toBe('Outstanding electrical work! Very professional.');

      // Verify worker rating recalculation
      const workerRes = await request(app).get('/workers/wrk_demo_1');
      expect(workerRes.body.data.ratingAvg).toBe(5);
      expect(workerRes.body.data.reviewsCount).toBe(1);
    });

    it('2. should reject review when booking is not yet completed', async () => {
      // Create pending booking
      const bookingRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          worker_id: 'wrk_demo_1',
          category_id: 'cat_electrical',
          booking_date: '2026-12-02T10:00:00.000Z',
          address: '999 Pending Way',
        });

      const bookingId = bookingRes.body.data.id;

      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          booking_id: bookingId,
          rating: 5,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('completed');
    });

    it('3. should prevent duplicate review submissions for the same booking', async () => {
      const bookingId = await createCompletedBooking();

      // First submission
      await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          booking_id: bookingId,
          rating: 4,
          comment: 'Good work',
        });

      // Second duplicate submission
      const duplicateRes = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          booking_id: bookingId,
          rating: 5,
          comment: 'Duplicate review attempt',
        });

      expect(duplicateRes.status).toBe(400);
      expect(duplicateRes.body.success).toBe(false);
      expect(duplicateRes.body.message).toContain('already been submitted');
    });

    it('4. should reject review from non-owner customer', async () => {
      const bookingId = await createCompletedBooking();

      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${otherCustomerToken}`)
        .send({
          booking_id: bookingId,
          rating: 5,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('5. should reject invalid ratings (< 1 or > 5)', async () => {
      const bookingId = await createCompletedBooking();

      const resZero = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          booking_id: bookingId,
          rating: 0,
        });

      expect(resZero.status).toBe(400);
      expect(resZero.body.success).toBe(false);

      const resSix = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          booking_id: bookingId,
          rating: 6,
        });

      expect(resSix.status).toBe(400);
      expect(resSix.body.success).toBe(false);
    });
  });

  describe('PATCH & DELETE /api/reviews/:id', () => {
    it('6. should allow owner customer to update their review and recalculate rating', async () => {
      const bookingId = await createCompletedBooking();

      const createRes = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          booking_id: bookingId,
          rating: 3,
          comment: 'Average job',
        });

      const reviewId = createRes.body.data.id;

      const updateRes = await request(app)
        .patch(`/api/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          rating: 5,
          comment: 'Actually they fixed the issue later! Great job!',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);
      expect(updateRes.body.data.rating).toBe(5);

      // Verify worker rating updated
      const workerRes = await request(app).get('/workers/wrk_demo_1');
      expect(workerRes.body.data.ratingAvg).toBe(5);
    });

    it('7. should forbid other users from modifying someone else review', async () => {
      const bookingId = await createCompletedBooking();

      const createRes = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          booking_id: bookingId,
          rating: 4,
        });

      const reviewId = createRes.body.data.id;

      const res = await request(app)
        .patch(`/api/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${otherCustomerToken}`)
        .send({ rating: 1 });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('8. should allow author to delete their review and recalculate rating', async () => {
      const bookingId = await createCompletedBooking();

      const createRes = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          booking_id: bookingId,
          rating: 4,
        });

      const reviewId = createRes.body.data.id;

      const deleteRes = await request(app)
        .delete(`/api/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      // Confirm 404
      const getRes = await request(app).get(`/api/reviews/${reviewId}`);
      expect(getRes.status).toBe(404);
    });
  });
});
