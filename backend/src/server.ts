import { app } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';

const server = app.listen(env.PORT, () => {
  const baseUrl = `http://localhost:${env.PORT}`;

  logger.info({ port: env.PORT, environment: env.NODE_ENV }, 'Server started');

  // Human-readable startup banner displaying all URLs ready for testing
  /* eslint-disable no-console */
  console.log('\n======================================================');
  console.log(`[OK] Service Provider Backend listening at: ${baseUrl}`);
  console.log('======================================================');
  console.log('Available Endpoints for Testing:');
  console.log(`  Health Check : GET  ${baseUrl}/`);
  console.log(`  Register     : POST ${baseUrl}/api/auth/register`);
  console.log(`  Login        : POST ${baseUrl}/api/auth/login`);
  console.log(`  Auth Profile : GET  ${baseUrl}/api/auth/me`);
  console.log('------------------------------------------------------');
  console.log('Categories & Workers:');
  console.log(`  Categories   : GET  ${baseUrl}/categories`);
  console.log(`  Workers      : GET  ${baseUrl}/workers?category_id=&search=&page=&limit=`);
  console.log(`  Worker Detail: GET  ${baseUrl}/workers/:id`);
  console.log(`  Worker Review: GET  ${baseUrl}/workers/:id/reviews`);
  console.log(`  Availability : PATCH ${baseUrl}/workers/me/availability`);
  console.log(`  Worker Stats : GET  ${baseUrl}/workers/me/stats`);
  console.log('------------------------------------------------------');
  console.log('Bookings & Reviews:');
  console.log(`  Create Book  : POST  ${baseUrl}/bookings`);
  console.log(`  My Bookings  : GET   ${baseUrl}/bookings/me?status=&page=&limit=`);
  console.log(`  Book Detail  : GET   ${baseUrl}/bookings/:id`);
  console.log(`  Cancel Book  : PATCH ${baseUrl}/bookings/:id/cancel`);
  console.log(`  Booking QR   : GET   ${baseUrl}/bookings/:id/qr`);
  console.log(`  Verify QR    : POST  ${baseUrl}/bookings/:id/verify-qr`);
  console.log(`  Accept Book  : PATCH ${baseUrl}/bookings/:id/accept`);
  console.log(`  Reject Book  : PATCH ${baseUrl}/bookings/:id/reject`);
  console.log(`  Complete Book: PATCH ${baseUrl}/bookings/:id/complete`);
  console.log(`  Submit Review: POST  ${baseUrl}/reviews`);
  console.log('------------------------------------------------------');
  console.log('Worker Jobs & KYC:');
  console.log(`  Job Requests : GET   ${baseUrl}/jobs/requests`);
  console.log(`  My Jobs      : GET   ${baseUrl}/jobs/me`);
  console.log(`  Job Detail   : GET   ${baseUrl}/jobs/:id`);
  console.log(`  Update Status: PATCH ${baseUrl}/jobs/:id/status`);
  console.log(`  Submit KYC   : POST  ${baseUrl}/kyc/submit`);
  console.log(`  KYC Status   : GET   ${baseUrl}/kyc/status`);
  console.log(`  Review KYC   : PATCH ${baseUrl}/admin/kyc/:id`);
  console.log('------------------------------------------------------');
  console.log('Users, Addresses, SOS & Notifications:');
  console.log(`  User Profile : GET   ${baseUrl}/users/me`);
  console.log(`  Edit Profile : PATCH ${baseUrl}/users/me`);
  console.log(`  Addresses    : GET   ${baseUrl}/addresses`);
  console.log(`  Add Address  : POST  ${baseUrl}/addresses`);
  console.log(`  Edit Address : PATCH ${baseUrl}/addresses/:id`);
  console.log(`  Del Address  : DELETE ${baseUrl}/addresses/:id`);
  console.log(`  SOS Alert    : POST  ${baseUrl}/sos`);
  console.log(`  Notifs List  : GET   ${baseUrl}/notifications`);
  console.log('------------------------------------------------------');
  console.log('Pre-Seeded Demo Accounts for Immediate Testing:');
  console.log('  Customer : user@example.com   | Password123!');
  console.log('  Worker   : worker@example.com | Password123!');
  console.log('  Admin    : admin@example.com  | Password123!');
  console.log('======================================================\n');
  /* eslint-enable no-console */
});

// Graceful shutdown handling
function handleShutdown(signal: string): void {
  logger.info(`Received ${signal}. Gracefully closing HTTP server...`);
  server.close(() => {
    logger.info('HTTP server closed. Exiting process.');
    process.exit(0);
  });

  // Force close after 10 seconds if graceful close hangs
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout while closing server connections.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

process.on('unhandledRejection', (reason: unknown) => {
  logger.error({ reason }, 'Unhandled Promise Rejection detected');
});

process.on('uncaughtException', (error: Error) => {
  logger.fatal({ err: error }, 'Uncaught Exception detected. Shutting down...');
  process.exit(1);
});
