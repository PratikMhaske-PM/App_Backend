import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { getDatabase, resetDatabase } from '../database/sqlite';
import { InMemoryUserRepository } from '../repositories/user.repo';
import { generateBookingVerificationHash } from '../utils/qr';
import { signAccessToken } from '../utils/jwt';

describe('Fixmate 17 Endpoints Integration Test Suite', () => {
  let app: ReturnType<typeof createApp>;
  let customerToken: string;
  let workerToken: string;
  let otherWorkerToken: string;
  let adminToken: string;

  beforeEach(() => {
    resetDatabase();
    getDatabase(':memory:');
    app = createApp(new InMemoryUserRepository());

    // Customer User
    customerToken = signAccessToken({
      userId: 'usr_demo_1',
      email: 'user@example.com',
      role: 'customer',
      name: 'Customer Test',
    });

    // Worker 1: usr_worker_1 (wrk_demo_1, cat_electrical)
    workerToken = signAccessToken({
      userId: 'usr_worker_1',
      email: 'worker@example.com',
      role: 'worker',
      name: 'Alex Rodriguez',
    });

    // Worker 2: usr_other_worker (wrk_plumbing_1, cat_plumbing)
    otherWorkerToken = signAccessToken({
      userId: 'usr_other_worker',
      email: 'plumber@example.com',
      role: 'worker',
      name: 'Bob The Plumber',
    });

    // Admin User
    adminToken = signAccessToken({
      userId: 'usr_admin_1',
      email: 'admin@example.com',
      role: 'admin',
      name: 'System Admin',
    });
  });

  // =========================================================================
  // MODULE A: WORKER JOBS & QR VERIFICATION
  // =========================================================================
  describe('Module A: Worker Jobs & QR Verification', () => {
    let createdBookingId: string;

    it('1. GET /jobs/requests - worker can view open service requests matching their category', async () => {
      // First, customer creates a booking
      const bookRes = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          worker_id: 'wrk_demo_1',
          category_id: 'cat_electrical',
          service_description: 'Electrical repair request',
          booking_date: '2026-11-20',
          address: '100 Main St',
          total_price: 85,
        });

      expect(bookRes.status).toBe(201);
      createdBookingId = bookRes.body.data.id;

      // Worker requests list
      const res = await request(app)
        .get('/jobs/requests')
        .set('Authorization', `Bearer ${workerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.jobs)).toBe(true);
      expect(res.body.data.jobs.length).toBeGreaterThan(0);
      expect(res.body.data.jobs[0]).toHaveProperty('serviceDescription');
      // Should not leak customer password or private user details
      expect(res.body.data.jobs[0]).not.toHaveProperty('passwordHash');
    });

    it('2. GET /jobs/requests - customer receives 403 Forbidden', async () => {
      const res = await request(app)
        .get('/jobs/requests')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });

    it('3. GET /jobs/me - worker can retrieve their assigned jobs history', async () => {
      const res = await request(app)
        .get('/jobs/me')
        .set('Authorization', `Bearer ${workerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('jobs');
      expect(res.body.data).toHaveProperty('pagination');
    });

    it('4. GET /jobs/:id - worker can fetch details of authorized job', async () => {
      // Ensure booking exists
      const bookRes = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          worker_id: 'wrk_demo_1',
          category_id: 'cat_electrical',
          service_description: 'Job inspection',
          booking_date: '2026-11-21',
          address: '200 Oak Ave',
        });
      const jobId = bookRes.body.data.id;

      const res = await request(app)
        .get(`/jobs/${jobId}`)
        .set('Authorization', `Bearer ${workerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(jobId);
    });

    it('5. PATCH /jobs/:id/status - worker can update job status through valid transitions', async () => {
      const bookRes = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          worker_id: 'wrk_demo_1',
          category_id: 'cat_electrical',
          service_description: 'Switchboard upgrade',
          booking_date: '2026-11-22',
          address: '300 Pine St',
        });
      const jobId = bookRes.body.data.id;

      // Pending -> confirmed
      const resAccept = await request(app)
        .patch(`/jobs/${jobId}/status`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ status: 'confirmed', note: 'Accepted job' });

      expect(resAccept.status).toBe(200);
      expect(resAccept.body.data.status.toUpperCase()).toBe('CONFIRMED');

      // Confirmed -> in_progress
      const resProgress = await request(app)
        .patch(`/jobs/${jobId}/status`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ status: 'in_progress' });

      expect(resProgress.status).toBe(200);
      expect(resProgress.body.data.status.toUpperCase()).toBe('IN_PROGRESS');

      // In_progress -> completed
      const resComplete = await request(app)
        .patch(`/jobs/${jobId}/status`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ status: 'completed' });

      expect(resComplete.status).toBe(200);
      expect(resComplete.body.data.status.toUpperCase()).toBe('COMPLETED');
    });

    it('6. PATCH /jobs/:id/status - rejects invalid status transition', async () => {
      const bookRes = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          worker_id: 'wrk_demo_1',
          category_id: 'cat_electrical',
          service_description: 'Direct completion test',
          booking_date: '2026-11-23',
          address: '400 Elm St',
        });
      const jobId = bookRes.body.data.id;

      // Cannot jump from pending directly to completed without confirmation
      const res = await request(app)
        .patch(`/jobs/${jobId}/status`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ status: 'completed' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid status transition');
    });

    it('7. POST /bookings/:id/verify-qr - assigned worker verifies valid QR code token', async () => {
      const bookRes = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          worker_id: 'wrk_demo_1',
          category_id: 'cat_electrical',
          service_description: 'QR Code verification test',
          booking_date: '2026-11-24',
          address: '500 Maple St',
        });
      const booking = bookRes.body.data;

      // Compute verification code
      const verificationCode = generateBookingVerificationHash(
        booking.id,
        booking.customerId,
        booking.workerId
      );

      // Verify QR
      const res = await request(app)
        .post(`/bookings/${booking.id}/verify-qr`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ verificationCode });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.verified).toBe(true);

      // Replay attempt should be rejected with 409 Conflict
      const replayRes = await request(app)
        .post(`/bookings/${booking.id}/verify-qr`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ verificationCode });

      expect(replayRes.status).toBe(409);
    });

    it('8. POST /bookings/:id/verify-qr - rejects invalid or tampered token', async () => {
      const bookRes = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          worker_id: 'wrk_demo_1',
          category_id: 'cat_electrical',
          service_description: 'Tampered QR test',
          booking_date: '2026-11-25',
          address: '600 Birch St',
        });
      const booking = bookRes.body.data;

      const res = await request(app)
        .post(`/bookings/${booking.id}/verify-qr`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ verificationCode: 'tampered_code_xyz' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid or tampered QR code');
    });
  });

  // =========================================================================
  // MODULE B & C: REVIEWS AND USER PROFILES
  // =========================================================================
  describe('Module B & C: Reviews and User Profiles', () => {
    it('9. POST /reviews - submits review only for completed booking and prevents duplicate', async () => {
      // 1. Create booking
      const bookRes = await request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          worker_id: 'wrk_demo_1',
          category_id: 'cat_electrical',
          service_description: 'Reviewable task',
          booking_date: '2026-11-26',
          address: '700 Cedar St',
        });
      const bookingId = bookRes.body.data.id;

      // 2. Cannot review before completed
      const earlyReview = await request(app)
        .post('/reviews')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          booking_id: bookingId,
          rating: 5,
          comment: 'Premature review',
        });
      expect(earlyReview.status).toBe(400);

      // 3. Worker completes booking
      await request(app)
        .patch(`/bookings/${bookingId}/accept`)
        .set('Authorization', `Bearer ${workerToken}`);
      await request(app)
        .patch(`/bookings/${bookingId}/complete`)
        .set('Authorization', `Bearer ${workerToken}`);

      // 4. Customer submits review
      const reviewRes = await request(app)
        .post('/reviews')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          booking_id: bookingId,
          rating: 5,
          comment: 'Fantastic service!',
        });
      expect(reviewRes.status).toBe(201);
      expect(reviewRes.body.data.rating).toBe(5);

      // 5. Duplicate review rejected
      const duplicateRes = await request(app)
        .post('/reviews')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          booking_id: bookingId,
          rating: 4,
          comment: 'Duplicate review',
        });
      expect(duplicateRes.status).toBe(400);
    });

    it('10. GET /users/me - retrieves profile without password hash', async () => {
      const res = await request(app)
        .get('/users/me')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('user@example.com');
      expect(res.body.data).not.toHaveProperty('passwordHash');
    });

    it('11. PATCH /users/me - updates profile and rejects role escalation', async () => {
      const res = await request(app)
        .patch('/users/me')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          name: 'Updated Name',
          phone: '+1-555-8888',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Name');
      expect(res.body.data.phone).toBe('+1-555-8888');

      // Attempting to modify role should be rejected by strict schema
      const roleAttempt = await request(app)
        .patch('/users/me')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          role: 'admin',
        });
      expect(roleAttempt.status).toBe(400);
    });
  });

  // =========================================================================
  // MODULE D: ADDRESS MANAGEMENT
  // =========================================================================
  describe('Module D: Address Management', () => {
    let createdAddressId: string;

    it('12. POST /addresses - creates a new address for authenticated user', async () => {
      const res = await request(app)
        .post('/addresses')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          label: 'Apartment',
          street: '123 Main Street, Apt 4B',
          city: 'New York',
          state: 'NY',
          postal_code: '10001',
          is_default: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.street).toBe('123 Main Street, Apt 4B');
      expect(res.body.data.userId).toBe('usr_demo_1');
      createdAddressId = res.body.data.id;
    });

    it('13. GET /addresses - lists user addresses with pagination', async () => {
      const res = await request(app)
        .get('/addresses')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.addresses)).toBe(true);
      expect(res.body.data.addresses.length).toBeGreaterThan(0);
    });

    it('14. PATCH /addresses/:id - updates address and prevents non-owner modification', async () => {
      // Owner updates
      const res = await request(app)
        .patch(`/addresses/${createdAddressId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          street: '123 Main Street, Suite 5C',
          label: 'New Apartment',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.street).toBe('123 Main Street, Suite 5C');

      // Non-owner receives 403 Forbidden
      const nonOwnerRes = await request(app)
        .patch(`/addresses/${createdAddressId}`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          street: 'Hijacked Address',
        });

      expect(nonOwnerRes.status).toBe(403);
    });

    it('15. DELETE /addresses/:id - deletes address and prevents non-owner deletion', async () => {
      // Non-owner attempt
      const nonOwnerRes = await request(app)
        .delete(`/addresses/${createdAddressId}`)
        .set('Authorization', `Bearer ${workerToken}`);
      expect(nonOwnerRes.status).toBe(403);

      // Owner delete
      const res = await request(app)
        .delete(`/addresses/${createdAddressId}`)
        .set('Authorization', `Bearer ${customerToken}`);
      expect(res.status).toBe(200);
    });
  });

  // =========================================================================
  // MODULE E: WORKER KYC
  // =========================================================================
  describe('Module E: Worker KYC', () => {
    let kycId: string;

    it('16. POST /kyc/submit - worker submits KYC verification and prevents duplicate pending', async () => {
      const res = await request(app)
        .post('/kyc/submit')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          document_type: 'passport',
          document_number: 'P-12345678',
          full_name: 'Alex Rodriguez',
          document_url: 'https://example.com/docs/passport.pdf',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('pending');
      kycId = res.body.data.id;

      // Duplicate submission while pending
      const dupRes = await request(app)
        .post('/kyc/submit')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          document_type: 'passport',
          document_number: 'P-99999999',
          full_name: 'Alex Rodriguez',
        });
      expect(dupRes.status).toBe(400);
      expect(dupRes.body.message).toContain('already have a KYC verification application');
    });

    it('17. GET /kyc/status - worker retrieves their KYC status', async () => {
      const res = await request(app)
        .get('/kyc/status')
        .set('Authorization', `Bearer ${workerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('status');
      expect(res.body.data).toHaveProperty('workerId');
    });

    it('18. PATCH /admin/kyc/:id - admin approves KYC; non-admins blocked', async () => {
      // Non-admin blocked
      const forbiddenRes = await request(app)
        .patch(`/admin/kyc/${kycId}`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ status: 'approved' });
      expect(forbiddenRes.status).toBe(403);

      // Admin approves
      const res = await request(app)
        .patch(`/admin/kyc/${kycId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'approved' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('approved');
    });
  });

  // =========================================================================
  // MODULE F: SOS EMERGENCY ALERTS
  // =========================================================================
  describe('Module F: SOS Emergency Alerts', () => {
    it('19. POST /sos - logs emergency alert and blocks immediate duplicate', async () => {
      const res = await request(app)
        .post('/sos')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          emergency_type: 'security',
          latitude: 40.7128,
          longitude: -74.006,
          notes: 'Immediate assistance requested',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.alert.status).toBe('active');
      expect(res.body.data).toHaveProperty('disclaimer');

      // Duplicate submission within 30s rejected
      const dupRes = await request(app)
        .post('/sos')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          emergency_type: 'security',
        });

      expect(dupRes.status).toBe(409);
    });

    it('20. POST /sos - rejects payload missing emergency_type', async () => {
      const res = await request(app)
        .post('/sos')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          notes: 'No emergency type provided',
        });

      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // MODULE G: NOTIFICATIONS
  // =========================================================================
  describe('Module G: Notifications', () => {
    it('21. GET /notifications - fetches authenticated user notifications with pagination', async () => {
      const res = await request(app)
        .get('/notifications?status=all&page=1&limit=10')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.notifications)).toBe(true);
      expect(res.body.data.pagination).toHaveProperty('total');
      // Verify isolation: customer notifications belong to customer
      for (const notif of res.body.data.notifications) {
        expect(notif.userId).toBe('usr_demo_1');
      }
    });

    it('22. GET /notifications - unauthenticated request rejected with 401', async () => {
      const res = await request(app).get('/notifications');
      expect(res.status).toBe(401);
    });
  });
});
