/// <reference path="./types/express.d.ts" />
import cors from 'cors';
import express, { Express } from 'express';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { errorHandler } from './middlewares/error.middleware';
import { notFoundHandler } from './middlewares/notFound.middleware';
import { adminRouter } from './modules/admin/admin.routes';
import { AuthController } from './modules/auth/auth.controller';
import { createAuthRouter } from './modules/auth/auth.routes';
import { AuthService } from './modules/auth/auth.service';
import { bookingsRouter } from './modules/bookings/bookings.routes';
import { categoriesRouter } from './modules/categories/categories.routes';
import { reviewsRouter } from './modules/reviews/reviews.routes';
import { usersRouter } from './modules/users/users.routes';
import { workersRouter } from './modules/workers/workers.routes';
import { defaultUserRepository, IUserRepository } from './repositories/user.repo';
import { logger } from './utils/logger';

/**
 * Application factory function.
 * Allows injecting repository dependencies for automated tests without mocking modules.
 */
export function createApp(userRepo: IUserRepository = defaultUserRepository): Express {
  const app = express();

  // 1. Security HTTP Headers
  app.use(helmet());

  // 2. Cross-Origin Resource Sharing (CORS)
  app.use(
    cors({
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // 3. Request body parsing with strict size limits
  app.use(express.json({ limit: '10kb' }));

  // 4. Structured HTTP request logging (suppressed during automated test runs)
  if (env.NODE_ENV !== 'test') {
    app.use(
      pinoHttp({
        logger,
        autoLogging: true,
      })
    );
  }

  // 5. Root Welcome / Health Check route for easy browser and testing discovery
  app.get('/', (_req, res) => {
    res.status(200).json({
      success: true,
      message: 'Service Provider Backend API is running!',
      endpoints: {
        auth: {
          register: 'POST /api/auth/register',
          login: 'POST /api/auth/login',
          profile: 'GET /api/auth/me',
        },
        categories: {
          list: 'GET /api/categories (or /categories)',
          detail: 'GET /api/categories/:id',
        },
        workers: {
          searchAndFilter: 'GET /api/workers?category_id=&search=&page=&limit=',
          detail: 'GET /api/workers/:id',
          reviews: 'GET /api/workers/:id/reviews',
          availability: 'PATCH /api/workers/me/availability',
          stats: 'GET /api/workers/me/stats',
          profile: 'GET /api/workers/me/profile',
          updateProfile: 'PATCH /api/workers/me/profile',
        },
        bookings: {
          create: 'POST /bookings (or /api/bookings)',
          myBookings: 'GET /bookings/me?status=&page=&limit=',
          detail: 'GET /bookings/:id',
          cancel: 'PATCH /bookings/:id/cancel',
          qrCode: 'GET /bookings/:id/qr',
          accept: 'PATCH /bookings/:id/accept',
          reject: 'PATCH /bookings/:id/reject',
          complete: 'PATCH /bookings/:id/complete',
        },
        reviews: {
          create: 'POST /api/reviews',
          detail: 'GET /api/reviews/:id',
          update: 'PATCH /api/reviews/:id',
          delete: 'DELETE /api/reviews/:id',
        },
        users: {
          profile: 'GET /api/users/me',
          updateProfile: 'PATCH /api/users/me',
          changePassword: 'PATCH /api/users/me/password',
        },
        admin: {
          workers: 'GET /api/admin/workers',
          verifyWorker: 'PATCH /api/admin/workers/:id/verify',
          stats: 'GET /api/admin/stats',
        },
      },
    });
  });

  // 6. Mount authentication module
  const authServiceInstance = new AuthService(userRepo);
  const authControllerInstance = new AuthController(authServiceInstance);
  const authRouterInstance = createAuthRouter(authControllerInstance);

  app.use('/api/auth', authRouterInstance);
  app.use('/auth', authRouterInstance);

  // 7. Mount Service Categories module (dual mounted with and without /api)
  app.use('/api/categories', categoriesRouter);
  app.use('/categories', categoriesRouter);

  // 8. Mount Workers module (dual mounted with and without /api)
  app.use('/api/workers', workersRouter);
  app.use('/workers', workersRouter);

  // 9. Mount Bookings module (dual mounted with and without /api)
  app.use('/api/bookings', bookingsRouter);
  app.use('/bookings', bookingsRouter);

  // 10. Mount Reviews module (dual mounted with and without /api)
  app.use('/api/reviews', reviewsRouter);
  app.use('/reviews', reviewsRouter);

  // 11. Mount Users module (dual mounted with and without /api)
  app.use('/api/users', usersRouter);
  app.use('/users', usersRouter);

  // 12. Mount Admin module (dual mounted with and without /api)
  app.use('/api/admin', adminRouter);
  app.use('/admin', adminRouter);

  // 13. Handle unmatched routes (404)
  app.use(notFoundHandler);

  // 14. Centralized error handling middleware (registered last)
  app.use(errorHandler);

  return app;
}

export const app = createApp(defaultUserRepository);
