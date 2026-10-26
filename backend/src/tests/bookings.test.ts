import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { getDatabase, resetDatabase } from '../database/sqlite';
import { InMemoryUserRepository } from '../repositories/user.repo';
import { signAccessToken } from '../utils/jwt';

describe('Booking Management Module APIs', () => {
  let app: ReturnType<typeof createApp>;
  let customerToken: string;
  let workerToken: string;
  let otherCustomerToken: string;
  let otherWorkerToken: string;

  beforeEach(() => {
    resetDatabase();
    getDatabase(':memory:');
    app = createApp(new InMemoryUserRepository());

    // Customer: usr_demo_1
    customerToken = signAccessToken({
      userId: 'usr_demo_1',
      email: 'user@example.com',
      role: 'customer',
      name: 'Demo Customer',
    });

    // Worker: usr_worker_1 (linked to wrk_demo_1, provides cat_electrical)
    workerToken = signAccessToken({
      userId: 'usr_worker_1',
      email: 'worker@example.com',
      role: 'worker',
      name: 'Alex Rodriguez',
    });

    // Other Customer: usr_other_customer
    otherCustomerToken = signAccessToken({
      userId: 'usr_other_customer',
      email: 'other@example.com',
      role: 'customer',
      name: 'Other Customer',
    });

    // Other Worker: usr_other_worker
    otherWorkerToken = signAccessToken({
      userId: 'usr_other_worker',
      email: 'other_worker@example.com',
      role: 'worker',
      name: 'Other Worker',
    });
  });

  describe('API 1: POST /bookings (Create Booking)', () => {
    it('1. should allow authenticated customer to create a booking with initial status PENDING', async () => {
      const res = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          worker_id: 'wrk_demo_1',
          category_id: 'cat_electrical',
          service_description: 'Fix blown fuse in main distribution panel',
          booking_date: '2026-11-25',
          booking_time: '10:00',
          address: '742 Evergreen Terrace, Springfield',
          latitude: 40.7128,
          longitude: -74.006,
          customer_id: 'spoofed_customer_id', // Should be ignored in favor of JWT payload
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Booking created successfully');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.status.toUpperCase()).toBe('PENDING');
      expect(res.body.data.customerId).toBe('usr_demo_1'); // Never trust customer_id from body
      expect(res.body.data.workerId).toBe('wrk_demo_1');
      expect(res.body.data.categoryId).toBe('cat_electrical');
      expect(res.body.data.address).toBe('742 Evergreen Terrace, Springfield');
      expect(res.body.data.latitude).toBe(40.7128);
      expect(res.body.data.longitude).toBe(-74.006);
    });

    it('2. should reject booking if worker does not provide the selected category service', async () => {
      // wrk_demo_1 is an electrician (cat_electrical), attempting to book for plumbing (cat_plumbing)
      const res = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          worker_id: 'wrk_demo_1',
          category_id: 'cat_plumbing',
          service_description: 'Fix bathroom pipe leak',
          booking_date: '2026-11-26',
          address: '100 Waterway Dr',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('does not provide services in the selected category');
    });

    it('3. should reject if customer attempts to book their own worker profile', async () => {
      // Try to create booking using workerToken on worker's own profile wrk_demo_1
      const res = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          worker_id: 'wrk_demo_1',
          category_id: 'cat_electrical',
          booking_date: '2026-11-27',
          address: '456 Self St',
        });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.success).toBe(false);
    });

    it('4. should reject duplicate pending booking requests for same worker and date', async () => {
      // 1st booking
      await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          worker_id: 'wrk_demo_1',
          category_id: 'cat_electrical',
          booking_date: '2026-11-28',
          booking_time: '14:00',
          address: '500 duplicate way',
        });

      // 2nd duplicate booking attempt
      const resDuplicate = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          worker_id: 'wrk_demo_1',
          category_id: 'cat_electrical',
          booking_date: '2026-11-28',
          booking_time: '14:00',
          address: '500 duplicate way',
        });

      expect(resDuplicate.status).toBe(400);
      expect(resDuplicate.body.success).toBe(false);
      expect(resDuplicate.body.message).toContain('already have a pending booking request');
    });

    it('5. should reject unauthenticated booking creation', async () => {
      const res = await request(app)
        .post('/bookings')
        .send({
          worker_id: 'wrk_demo_1',
          category_id: 'cat_electrical',
          booking_date: '2026-11-29',
          address: '123 Anonymous St',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('API 2: GET /bookings/me (Get My Bookings)', () => {
    beforeEach(async () => {
      // Seed two bookings for usr_demo_1
      await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          worker_id: 'wrk_demo_1',
          category_id: 'cat_electrical',
          service_description: 'First job',
          booking_date: '2026-11-10',
          address: 'Address 1',
        });

      await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          worker_id: 'wrk_demo_1',
          category_id: 'cat_electrical',
          service_description: 'Second job',
          booking_date: '2026-11-15',
          address: 'Address 2',
        });
    });

    it('6. should fetch bookings belonging to the authenticated customer with pagination metadata', async () => {
      const res = await request(app)
        .get('/bookings/me?page=1&limit=10')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('bookings');
      expect(res.body.data).toHaveProperty('pagination');
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.limit).toBe(10);
      expect(res.body.data.bookings.length).toBe(2);

      // Verify joined worker and category information
      const booking = res.body.data.bookings[0];
      expect(booking.customerId).toBe('usr_demo_1');
      expect(booking).toHaveProperty('workerName');
      expect(booking).toHaveProperty('categoryName');
    });

    it('7. should support case-insensitive filtering by status (e.g. status=PENDING)', async () => {
      const res = await request(app)
        .get('/bookings/me?status=PENDING')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      for (const b of res.body.data.bookings) {
        expect(b.status.toUpperCase()).toBe('PENDING');
      }
    });

    it('8. should prevent other customers from seeing another user bookings', async () => {
      const res = await request(app)
        .get('/bookings/me')
        .set('Authorization', `Bearer ${otherCustomerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.bookings.length).toBe(0); // Other customer has 0 bookings
    });
  });

  describe('API 3: GET /bookings/:id (Get Booking Details)', () => {
    let testBookingId: string;

    beforeEach(async () => {
      const createRes = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          worker_id: 'wrk_demo_1',
          category_id: 'cat_electrical',
          service_description: 'Panel inspection',
          booking_date: '2026-11-20',
          address: '404 Details Way',
        });
      testBookingId = createRes.body.data.id;
    });

    it('9. should allow the customer who created the booking to view complete details', async () => {
      const res = await request(app)
        .get(`/bookings/${testBookingId}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testBookingId);
      expect(res.body.data.customerId).toBe('usr_demo_1');
      expect(res.body.data.workerId).toBe('wrk_demo_1');
      expect(res.body.data).toHaveProperty('customerName');
      expect(res.body.data).toHaveProperty('workerName');
      expect(res.body.data).not.toHaveProperty('passwordHash');
    });

    it('10. should allow the assigned worker to view booking details', async () => {
      const res = await request(app)
        .get(`/bookings/${testBookingId}`)
        .set('Authorization', `Bearer ${workerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testBookingId);
    });

    it('11. should forbid unrelated customer from accessing another customer booking details', async () => {
      const res = await request(app)
        .get(`/bookings/${testBookingId}`)
        .set('Authorization', `Bearer ${otherCustomerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('permission');
    });
  });

  describe('API 4: PATCH /bookings/:id/cancel (Cancel Booking)', () => {
    let testBookingId: string;

    beforeEach(async () => {
      const createRes = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          worker_id: 'wrk_demo_1',
          category_id: 'cat_electrical',
          service_description: 'To be cancelled',
          booking_date: '2026-11-30',
          address: '999 Cancel Dr',
        });
      testBookingId = createRes.body.data.id;
    });

    it('12. should allow customer to cancel their own booking and store reason and timestamp', async () => {
      const res = await request(app)
        .patch(`/bookings/${testBookingId}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          cancellation_reason: 'Emergency travel required',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status.toUpperCase()).toBe('CANCELLED');
      expect(res.body.data.cancellationReason).toBe('Emergency travel required');
      expect(res.body.data).toHaveProperty('cancelledAt');
    });

    it('13. should prevent duplicate cancellation of already cancelled booking', async () => {
      // First cancel
      await request(app)
        .patch(`/bookings/${testBookingId}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`);

      // Second cancel attempt
      const resSecond = await request(app)
        .patch(`/bookings/${testBookingId}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(resSecond.status).toBe(400);
      expect(resSecond.body.success).toBe(false);
      expect(resSecond.body.message).toContain('already cancelled');
    });

    it('14. should forbid other customers from cancelling a booking they do not own', async () => {
      const res = await request(app)
        .patch(`/bookings/${testBookingId}/cancel`)
        .set('Authorization', `Bearer ${otherCustomerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('15. should prevent cancellation of completed bookings', async () => {
      // Accept and complete the booking
      await request(app)
        .patch(`/bookings/${testBookingId}/accept`)
        .set('Authorization', `Bearer ${workerToken}`);

      await request(app)
        .patch(`/bookings/${testBookingId}/complete`)
        .set('Authorization', `Bearer ${workerToken}`);

      // Try to cancel
      const cancelRes = await request(app)
        .patch(`/bookings/${testBookingId}/cancel`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(cancelRes.status).toBe(400);
      expect(cancelRes.body.success).toBe(false);
      expect(cancelRes.body.message).toContain('Completed bookings cannot be cancelled');
    });
  });

  describe('API 5: GET /bookings/:id/qr (Get Booking QR Code)', () => {
    let testBookingId: string;

    beforeEach(async () => {
      const createRes = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          worker_id: 'wrk_demo_1',
          category_id: 'cat_electrical',
          service_description: 'QR generation test',
          booking_date: '2026-12-05',
          address: '555 QR Way',
        });
      testBookingId = createRes.body.data.id;
    });

    it('16. should generate QR code data URL and verification hash for authenticated booking customer', async () => {
      const res = await request(app)
        .get(`/bookings/${testBookingId}/qr`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('bookingId', testBookingId);
      expect(res.body.data).toHaveProperty('verificationCode');
      expect(res.body.data).toHaveProperty('dataUrl');
      expect(res.body.data.dataUrl).toContain('data:image/svg+xml;base64,');
      expect(res.body.data).toHaveProperty('svg');
      expect(res.body.data.svg).toContain('<svg');
      expect(res.body.data).toHaveProperty('qrPayload');
      expect(res.body.data.qrPayload.bookingId).toBe(testBookingId);
      expect(res.body.data.qrPayload.customerId).toBe('usr_demo_1');
    });

    it('17. should forbid other customers from generating or accessing another booking QR code', async () => {
      const res = await request(app)
        .get(`/bookings/${testBookingId}/qr`)
        .set('Authorization', `Bearer ${otherCustomerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('18. should return 404 for nonexistent booking ID QR request', async () => {
      const res = await request(app)
        .get('/bookings/nonexistent_booking_id_999/qr')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
