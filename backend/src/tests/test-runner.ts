import request from 'supertest';
import { createApp } from '../app';
import { getDatabase, resetDatabase } from '../database/sqlite';
import { defaultUserRepository } from '../repositories/user.repo';

interface TestResult {
  step: number;
  api: string;
  method: string;
  expectedStatus: number;
  actualStatus: number;
  statusText: 'PASS' | 'FAIL';
  details: string;
}

export async function runAllApiTests(): Promise<TestResult[]> {
  // Use in-memory SQLite database to ensure production DB is not modified
  resetDatabase();
  getDatabase(':memory:');

  const app = createApp(defaultUserRepository);
  const results: TestResult[] = [];
  let stepCounter = 1;

  async function testApi(
    name: string,
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    url: string,
    expectedStatus: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fn: () => request.Test,
    validate?: (body: any) => boolean
  ) {
    try {
      const res = await fn();
      const passedStatus = res.status === expectedStatus;
      const passedValidation = validate ? validate(res.body) : true;
      const pass = passedStatus && passedValidation;

      results.push({
        step: stepCounter++,
        api: name,
        method,
        expectedStatus,
        actualStatus: res.status,
        statusText: pass ? 'PASS' : 'FAIL',
        details: pass
          ? `Status ${res.status} OK - ${res.body.message || 'Success'}`
          : `Expected ${expectedStatus} but got ${res.status}: ${JSON.stringify(res.body)}`,
      });
      return res;
    } catch (err) {
      results.push({
        step: stepCounter++,
        api: name,
        method,
        expectedStatus,
        actualStatus: 0,
        statusText: 'FAIL',
        details: `Exception: ${String(err)}`,
      });
      throw err;
    }
  }

  // 1. Root Health Check
  await testApi('Health Check', 'GET', '/', 200, () => request(app).get('/'));

  // 2. Register New Customer
  const registerCustomerRes = await testApi(
    'Register Customer',
    'POST',
    '/api/auth/register',
    201,
    () =>
      request(app).post('/api/auth/register').send({
        email: 'sarah.connor@example.com',
        password: 'SecurePassword123!',
        name: 'Sarah Connor',
        phone: '+1-555-0155',
        role: 'customer',
      })
  );
  const customerToken = registerCustomerRes.body.data.accessToken;

  // 3. Register New Worker
  const registerWorkerRes = await testApi(
    'Register Worker',
    'POST',
    '/api/auth/register',
    201,
    () =>
      request(app).post('/api/auth/register').send({
        email: 'john.carpenter@example.com',
        password: 'SecurePassword123!',
        name: 'John Carpenter',
        phone: '+1-555-0188',
        role: 'worker',
      })
  );
  const newWorkerToken = registerWorkerRes.body.data.accessToken;

  // 4. Login with Default Seeded Accounts
  const loginCustomerRes = await testApi('Login Customer', 'POST', '/api/auth/login', 200, () =>
    request(app).post('/api/auth/login').send({
      email: 'user@example.com',
      password: 'Password123!',
    })
  );
  const demoCustomerToken = loginCustomerRes.body.data.accessToken;

  const loginWorkerRes = await testApi('Login Worker', 'POST', '/api/auth/login', 200, () =>
    request(app).post('/api/auth/login').send({
      email: 'worker@example.com',
      password: 'Password123!',
    })
  );
  const demoWorkerToken = loginWorkerRes.body.data.accessToken;

  const loginAdminRes = await testApi('Login Admin', 'POST', '/api/auth/login', 200, () =>
    request(app).post('/api/auth/login').send({
      email: 'admin@example.com',
      password: 'Password123!',
    })
  );
  const adminToken = loginAdminRes.body.data.accessToken;

  // 5. Auth Context (GET /api/auth/me)
  await testApi('Auth Context (/me)', 'GET', '/api/auth/me', 200, () =>
    request(app).get('/api/auth/me').set('Authorization', `Bearer ${demoCustomerToken}`)
  );

  // 6. Categories List
  await testApi('List Categories', 'GET', '/categories', 200, () =>
    request(app).get('/categories')
  );

  // 7. Category by ID
  await testApi('Category by ID', 'GET', '/categories/cat_electrical', 200, () =>
    request(app).get('/categories/cat_electrical')
  );

  // 8. Search & Filter Workers
  await testApi('Search & Filter Workers', 'GET', '/workers', 200, () =>
    request(app).get('/workers?category_id=cat_electrical&page=1&limit=10')
  );

  // 9. Worker Details
  await testApi('Worker Details', 'GET', '/workers/wrk_demo_1', 200, () =>
    request(app).get('/workers/wrk_demo_1')
  );

  // 10. Worker Reviews (Initial)
  await testApi('Worker Reviews', 'GET', '/workers/wrk_demo_1/reviews', 200, () =>
    request(app).get('/workers/wrk_demo_1/reviews')
  );

  // 11. Worker Updates Availability
  await testApi('Worker Availability Update', 'PATCH', '/workers/me/availability', 200, () =>
    request(app)
      .patch('/workers/me/availability')
      .set('Authorization', `Bearer ${demoWorkerToken}`)
      .send({
        is_available: true,
        availability_status: 'available',
      })
  );

  // 12. Worker Profile Fetch
  await testApi('Worker View Profile', 'GET', '/workers/me/profile', 200, () =>
    request(app).get('/workers/me/profile').set('Authorization', `Bearer ${demoWorkerToken}`)
  );

  // 13. Worker Updates Profile
  await testApi('Worker Update Profile', 'PATCH', '/workers/me/profile', 200, () =>
    request(app)
      .patch('/workers/me/profile')
      .set('Authorization', `Bearer ${demoWorkerToken}`)
      .send({
        title: 'Master Licensed Electrician',
        hourly_rate: 70.0,
        location: 'New York Metro Area',
      })
  );

  // 14. Customer Creates Booking (API 1: POST /bookings)
  const createBookingRes = await testApi(
    'Create Booking',
    'POST',
    '/bookings',
    201,
    () =>
      request(app)
        .post('/bookings')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          worker_id: 'wrk_demo_1',
          category_id: 'cat_electrical',
          service_description: 'Inspection and wiring test',
          booking_date: '2026-11-20',
          booking_time: '10:00',
          address: '42 Wallaby Way, Sydney',
          latitude: -33.8688,
          longitude: 151.2093,
          total_price: 70.0,
        })
  );
  const bookingId = createBookingRes.body.data.id;

  // 15. Customer Fetches Own Bookings (API 2: GET /bookings/me)
  await testApi('Customer Get My Bookings (/me)', 'GET', '/bookings/me?status=PENDING', 200, () =>
    request(app).get('/bookings/me?status=PENDING').set('Authorization', `Bearer ${customerToken}`)
  );

  // 16. Customer Retrieves Booking QR Code (API 5: GET /bookings/:id/qr)
  await testApi('Get Booking QR Code', 'GET', `/bookings/${bookingId}/qr`, 200, () =>
    request(app)
      .get(`/bookings/${bookingId}/qr`)
      .set('Authorization', `Bearer ${customerToken}`)
  );

  // 17. View Booking Details (API 3: GET /bookings/:id)
  await testApi('View Booking Detail', 'GET', `/bookings/${bookingId}`, 200, () =>
    request(app)
      .get(`/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${customerToken}`)
  );

  // 18. Worker Accepts Booking
  await testApi('Worker Accept Booking', 'PATCH', `/bookings/${bookingId}/accept`, 200, () =>
    request(app)
      .patch(`/bookings/${bookingId}/accept`)
      .set('Authorization', `Bearer ${demoWorkerToken}`)
  );

  // 19. Worker Completes Booking
  await testApi('Worker Complete Booking', 'PATCH', `/bookings/${bookingId}/complete`, 200, () =>
    request(app)
      .patch(`/bookings/${bookingId}/complete`)
      .set('Authorization', `Bearer ${demoWorkerToken}`)
  );

  // Demonstrate Customer Cancelling Their Booking (API 4: PATCH /bookings/:id/cancel)
  const cancelTestBookingRes = await request(app)
    .post('/bookings')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      worker_id: 'wrk_demo_1',
      category_id: 'cat_electrical',
      service_description: 'Job to be cancelled',
      booking_date: '2026-11-28',
      address: '100 Cancel St',
    });
  const cancelBookingId = cancelTestBookingRes.body.data.id;

  await testApi('Cancel Booking', 'PATCH', `/bookings/${cancelBookingId}/cancel`, 200, () =>
    request(app)
      .patch(`/bookings/${cancelBookingId}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ cancellation_reason: 'Client schedule change' })
  );

  // 19. Worker Dashboard Statistics
  await testApi('Worker Dashboard Stats', 'GET', '/workers/me/stats', 200, () =>
    request(app).get('/workers/me/stats').set('Authorization', `Bearer ${demoWorkerToken}`)
  );

  // 20. Customer Submits Review for Completed Booking
  const createReviewRes = await testApi(
    'Submit Review',
    'POST',
    '/api/reviews',
    201,
    () =>
      request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          booking_id: bookingId,
          rating: 5,
          comment: 'Outstanding and timely service! Highly recommended.',
        })
  );
  const reviewId = createReviewRes.body.data.id;

  // 21. Fetch Review by ID
  await testApi('Fetch Review by ID', 'GET', `/api/reviews/${reviewId}`, 200, () =>
    request(app).get(`/api/reviews/${reviewId}`)
  );

  // 22. Customer Updates Own Review
  await testApi('Customer Update Review', 'PATCH', `/api/reviews/${reviewId}`, 200, () =>
    request(app)
      .patch(`/api/reviews/${reviewId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        rating: 5,
        comment: 'Updated: Still the best electrician around!',
      })
  );

  // 23. Customer Profile Management (GET /users/me)
  await testApi('User Profile Get', 'GET', '/users/me', 200, () =>
    request(app).get('/users/me').set('Authorization', `Bearer ${customerToken}`)
  );

  // 24. Customer Profile Update (PATCH /users/me)
  await testApi('User Profile Update', 'PATCH', '/users/me', 200, () =>
    request(app)
      .patch('/users/me')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        name: 'Sarah Connor (Updated)',
        phone: '+1-555-0999',
      })
  );

  // 25. Password Change (PATCH /users/me/password)
  await testApi('User Password Change', 'PATCH', '/users/me/password', 200, () =>
    request(app)
      .patch('/users/me/password')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        current_password: 'SecurePassword123!',
        new_password: 'NewStrongPassword456!',
      })
  );

  // 26. Admin Lists Workers
  await testApi('Admin List Workers', 'GET', '/admin/workers', 200, () =>
    request(app).get('/admin/workers').set('Authorization', `Bearer ${adminToken}`)
  );

  // 27. Admin Verifies Worker
  await testApi('Admin Verify Worker', 'PATCH', '/admin/workers/wrk_demo_1/verify', 200, () =>
    request(app)
      .patch('/admin/workers/wrk_demo_1/verify')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' })
  );

  // 28. Admin Platform System Stats
  await testApi('Admin System Stats', 'GET', '/admin/stats', 200, () =>
    request(app).get('/admin/stats').set('Authorization', `Bearer ${adminToken}`)
  );

  // 29. Security Test: Privilege Escalation Prevention (Non-admin accessing admin endpoint)
  await testApi(
    'Security: Non-Admin Access Forbidden',
    'GET',
    '/admin/stats',
    403,
    () => request(app).get('/admin/stats').set('Authorization', `Bearer ${customerToken}`)
  );

  // 30. Security Test: Unauthenticated Access Rejection
  await testApi('Security: Unauthenticated Rejected', 'GET', '/users/me', 401, () =>
    request(app).get('/users/me')
  );

  // 31. Security Test: Invalid ID 404
  await testApi('Security: Invalid ID 404', 'GET', '/workers/nonexistent_id_999', 404, () =>
    request(app).get('/workers/nonexistent_id_999')
  );

  // 32. Validation Test: Reject Invalid Email Format
  await testApi(
    'Validation: Reject Malformed Email',
    'POST',
    '/api/auth/login',
    400,
    () =>
      request(createApp()).post('/api/auth/login').send({
        email: 'invalid-email-format',
        password: 'Password123!',
      })
  );

  // 33. Worker Jobs: Fetch Available Requests
  await testApi('Worker Jobs: Fetch Requests', 'GET', '/jobs/requests', 200, () =>
    request(app).get('/jobs/requests').set('Authorization', `Bearer ${demoWorkerToken}`)
  );

  // 34. Worker Jobs: Fetch Assigned Jobs
  await testApi('Worker Jobs: Fetch My Jobs', 'GET', '/jobs/me', 200, () =>
    request(app).get('/jobs/me').set('Authorization', `Bearer ${demoWorkerToken}`)
  );

  // 35. Worker QR Verification
  await testApi('Bookings: Verify QR Token', 'POST', `/bookings/${bookingId}/verify-qr`, 200, () =>
    request(app)
      .post(`/bookings/${bookingId}/verify-qr`)
      .set('Authorization', `Bearer ${demoWorkerToken}`)
      .send({ token: `QR_${bookingId}` })
  );

  // 36. Addresses: Create Address
  let newAddressId = '';
  await testApi('Addresses: Create Address', 'POST', '/addresses', 201, () =>
    request(app)
      .post('/addresses')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        label: 'Home',
        street: '123 Test Boulevard',
        city: 'Metropolis',
        state: 'NY',
        postal_code: '10001',
      }),
    (body) => {
      newAddressId = body.data?.id;
      return !!newAddressId;
    }
  );

  // 37. Addresses: List User Addresses
  await testApi('Addresses: List Addresses', 'GET', '/addresses', 200, () =>
    request(app).get('/addresses').set('Authorization', `Bearer ${customerToken}`)
  );

  // 38. Addresses: Update Address
  if (newAddressId) {
    await testApi('Addresses: Update Address', 'PATCH', `/addresses/${newAddressId}`, 200, () =>
      request(app)
        .patch(`/addresses/${newAddressId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ label: 'Updated Home' })
    );

    // 39. Addresses: Delete Address
    await testApi('Addresses: Delete Address', 'DELETE', `/addresses/${newAddressId}`, 200, () =>
      request(app)
        .delete(`/addresses/${newAddressId}`)
        .set('Authorization', `Bearer ${customerToken}`)
    );
  }

  // 40. KYC: Worker Submits Verification
  let createdKycId = '';
  await testApi('KYC: Submit Verification', 'POST', '/kyc/submit', 201, () =>
    request(app)
      .post('/kyc/submit')
      .set('Authorization', `Bearer ${demoWorkerToken}`)
      .send({
        document_type: 'passport',
        document_number: 'P-55443322',
        full_name: 'Alex Rodriguez',
      }),
    (body) => {
      createdKycId = body.data?.id;
      return !!createdKycId;
    }
  );

  // 41. KYC: Worker Checks Status
  await testApi('KYC: Check Status', 'GET', '/kyc/status', 200, () =>
    request(app).get('/kyc/status').set('Authorization', `Bearer ${demoWorkerToken}`)
  );

  // 42. KYC: Admin Reviews KYC
  if (createdKycId) {
    await testApi('KYC: Admin Approval', 'PATCH', `/admin/kyc/${createdKycId}`, 200, () =>
      request(app)
        .patch(`/admin/kyc/${createdKycId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'approved' })
    );
  }

  // 43. SOS: Create Emergency Alert
  await testApi('SOS: Dispatch Alert', 'POST', '/sos', 201, () =>
    request(app)
      .post('/sos')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        emergency_type: 'accident',
        notes: 'Testing emergency SOS alert',
      })
  );

  // 44. Notifications: Retrieve User Notifications
  await testApi('Notifications: List Notifications', 'GET', '/notifications', 200, () =>
    request(app).get('/notifications').set('Authorization', `Bearer ${customerToken}`)
  );

  return results;
}

// Execute directly if run via ts-node or vitest
if (require.main === module) {
  runAllApiTests()
    .then((results) => {
      /* eslint-disable no-console */
      console.log('\n======================================================');
      console.log('         API END-TO-END TEST SUITE EXECUTION           ');
      console.log('======================================================\n');
      let passCount = 0;
      for (const r of results) {
        const symbol = r.statusText === 'PASS' ? '✅' : '❌';
        if (r.statusText === 'PASS') passCount++;
        console.log(
          `${symbol} [Step ${String(r.step).padStart(2, '0')}] ${r.method.padEnd(6)} ${r.api.padEnd(35)} -> ${r.details}`
        );
      }
      console.log('\n------------------------------------------------------');
      console.log(`TOTAL EXECUTED: ${results.length} | PASSED: ${passCount} | FAILED: ${results.length - passCount}`);
      console.log('======================================================\n');
      /* eslint-enable no-console */
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('Test execution failed:', err);
      process.exit(1);
    });
}
