import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import { env } from '../config/env';
import {
  InMemoryUserRepository,
  IUserRepository,
  PendingUserRepository,
} from '../repositories/user.repo';
import { UserAccount } from '../types/common.types';
import { signAccessToken } from '../utils/jwt';

describe('Authentication & Authorization Module', () => {
  const TEST_PASSWORD = 'SecurePassword123!';
  let passwordHash: string;
  let mockUser: UserAccount;
  let mockUserRepo: IUserRepository;

  beforeEach(async () => {
    // Generate bcrypt hash for testing (work factor 10 for test speed)
    passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

    mockUser = {
      id: 'usr_test_123',
      email: 'user@example.com',
      passwordHash,
      role: 'user',
      name: 'Test User',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockUserRepo = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
    };
  });

  describe('POST /api/auth/register', () => {
    it('1. should register a new user successfully and return JWT (never returning passwords)', async () => {
      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(null);
      vi.mocked(mockUserRepo.create).mockResolvedValue({
        ...mockUser,
        email: 'newuser@example.com',
        name: 'New User',
      });
      const app = createApp(mockUserRepo);

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'NewStrongPassword123!',
          name: 'New User',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Registration successful');
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data.tokenType).toBe('Bearer');
      expect(res.body.data.user).toEqual({
        id: 'usr_test_123',
        email: 'newuser@example.com',
        role: 'user',
        name: 'New User',
      });

      // Crucial Security Checks: Never leak credentials or password hashes
      expect(res.body.data).not.toHaveProperty('password');
      expect(res.body.data).not.toHaveProperty('passwordHash');
      expect(res.body.data.user).not.toHaveProperty('password');
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('2. should reject registration when email already exists', async () => {
      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(mockUser);
      const app = createApp(mockUserRepo);

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'user@example.com',
          password: 'NewStrongPassword123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });

    it('3. should reject registration with short password (< 8 chars)', async () => {
      const app = createApp(mockUserRepo);

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'valid@example.com',
          password: 'short',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body.errors)).toContain('at least 8 characters');
    });
  });

  describe('POST /api/auth/login', () => {
    it('4. should login successfully with valid credentials and return JWT (never returning passwords)', async () => {
      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(mockUser);
      const app = createApp(mockUserRepo);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@example.com',
          password: TEST_PASSWORD,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Login successful');
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data.tokenType).toBe('Bearer');
      expect(res.body.data.user).toEqual({
        id: 'usr_test_123',
        email: 'user@example.com',
        role: 'user',
        name: 'Test User',
      });

      // Crucial Security Checks: Never leak credentials or password hashes
      expect(res.body.data).not.toHaveProperty('password');
      expect(res.body.data).not.toHaveProperty('passwordHash');
      expect(res.body.data.user).not.toHaveProperty('password');
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('5. should reject login with incorrect password using a generic error message', async () => {
      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(mockUser);
      const app = createApp(mockUserRepo);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@example.com',
          password: 'WrongPassword!',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('6. should reject unknown account with generic error message to prevent account enumeration', async () => {
      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(null);
      const app = createApp(mockUserRepo);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: TEST_PASSWORD,
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      // The error message must match the incorrect password error exactly
      expect(res.body.message).toBe('Invalid email or password');
    });

    it('7. should reject disabled accounts', async () => {
      const disabledUser: UserAccount = {
        ...mockUser,
        isActive: false,
      };
      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(disabledUser);
      const app = createApp(mockUserRepo);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@example.com',
          password: TEST_PASSWORD,
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Account is disabled. Please contact support.');
    });

    it('8. should reject invalid request body (malformed email, unexpected fields)', async () => {
      const app = createApp(mockUserRepo);

      // Malformed email
      const resMalformedEmail = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'not-an-email',
          password: TEST_PASSWORD,
        });

      expect(resMalformedEmail.status).toBe(400);
      expect(resMalformedEmail.body.success).toBe(false);
      expect(resMalformedEmail.body.message).toBe('Validation failed');

      // Unexpected extra fields (strict schema validation)
      const resUnexpectedField = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@example.com',
          password: TEST_PASSWORD,
          isAdmin: true,
        });

      expect(resUnexpectedField.status).toBe(400);
      expect(resUnexpectedField.body.success).toBe(false);
    });

    it('9. should reject missing email or password', async () => {
      const app = createApp(mockUserRepo);

      // Missing password
      const resNoPassword = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@example.com' });
      expect(resNoPassword.status).toBe(400);
      expect(resNoPassword.body.success).toBe(false);

      // Missing email
      const resNoEmail = await request(app)
        .post('/api/auth/login')
        .send({ password: TEST_PASSWORD });
      expect(resNoEmail.status).toBe(400);
      expect(resNoEmail.body.success).toBe(false);

      // Completely empty body
      const resEmpty = await request(app)
        .post('/api/auth/login')
        .send({});
      expect(resEmpty.status).toBe(400);
      expect(resEmpty.body.success).toBe(false);
    });

    it('10. should enforce 72-byte maximum password size (bcrypt ceiling)', async () => {
      const app = createApp(mockUserRepo);
      const oversizedPassword = 'A'.repeat(73);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@example.com',
          password: oversizedPassword,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body.errors)).toContain('72 bytes');
    });
  });

  describe('JWT Verification & Protected Routes (GET /api/auth/me)', () => {
    it('11. should allow access with valid JWT', async () => {
      const app = createApp(mockUserRepo);
      const token = signAccessToken({
        userId: 'usr_test_123',
        email: 'user@example.com',
        role: 'user',
        name: 'Test User',
      });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toEqual({
        userId: 'usr_test_123',
        email: 'user@example.com',
        role: 'user',
        name: 'Test User',
      });
    });

    it('12. should reject request with invalid JWT signature or format', async () => {
      const app = createApp(mockUserRepo);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.tampered.token');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid token signature or format');
    });

    it('13. should reject expired JWT', async () => {
      const app = createApp(mockUserRepo);
      const expiredToken = jwt.sign(
        { sub: 'usr_test_123', email: 'user@example.com', role: 'user' },
        env.JWT_ACCESS_SECRET,
        {
          algorithm: 'HS256',
          expiresIn: '-10s',
          issuer: env.JWT_ISSUER,
          audience: env.JWT_AUDIENCE,
        }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Token has expired');
    });

    it('14. should reject protected route when Authorization header is missing or malformed', async () => {
      const app = createApp(mockUserRepo);

      // Missing header
      const resMissing = await request(app).get('/api/auth/me');
      expect(resMissing.status).toBe(401);
      expect(resMissing.body.message).toBe('Authentication token is required');

      // Malformed header (non-bearer)
      const resMalformed = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Basic dXNlcjpwYXNz');
      expect(resMalformed.status).toBe(401);
      expect(resMalformed.body.message).toContain('Expected "Bearer <token>"');
    });
  });

  describe('Rate Limiting & Security Controls', () => {
    it('15. should block requests with HTTP 429 when rate limit is exceeded', async () => {
      vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(mockUser);
      const app = createApp(mockUserRepo);

      // Send 5 valid attempts
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post('/api/auth/login')
          .send({ email: 'user@example.com', password: TEST_PASSWORD });
        expect(res.status).toBe(200);
      }

      // 6th attempt must trigger rate limiter
      const blockedRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: TEST_PASSWORD });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.success).toBe(false);
      expect(blockedRes.body.message).toContain('Too many login attempts');
      expect(blockedRes.headers).toHaveProperty('ratelimit-limit');
      expect(blockedRes.headers).toHaveProperty('ratelimit-remaining');
    });
  });

  describe('Database-free In-Memory Provider Integration', () => {
    it('16. should register and then log in without a database using InMemoryUserRepository', async () => {
      const inMemoryRepo = new InMemoryUserRepository();
      const app = createApp(inMemoryRepo);

      // 1. Register a new user
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'alice@example.com',
          password: 'AliceStrongPassword123!',
          name: 'Alice Cooper',
        });

      expect(registerRes.status).toBe(201);
      expect(registerRes.body.data.user.email).toBe('alice@example.com');

      // 2. Login with newly registered credentials
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'alice@example.com',
          password: 'AliceStrongPassword123!',
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.data.user.email).toBe('alice@example.com');
      expect(loginRes.body.data.user.name).toBe('Alice Cooper');
    });

    it('17. default seeded demo user allows immediate login without registering', async () => {
      const inMemoryRepo = new InMemoryUserRepository();
      const app = createApp(inMemoryRepo);

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('user@example.com');
    });

    it('18. PendingUserRepository should explicitly fail when invoked', async () => {
      const pendingRepo = new PendingUserRepository();
      await expect(pendingRepo.findByEmail('test@example.com')).rejects.toThrow(
        'Account provider is not configured. Database integration is pending.'
      );
      await expect(
        pendingRepo.create({
          email: 'test@example.com',
          passwordHash: 'hash',
        })
      ).rejects.toThrow(
        'Account provider is not configured. Database integration is pending.'
      );
    });
  });
});
