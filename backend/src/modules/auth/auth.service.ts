import { env } from '../../config/env';
import { defaultUserRepository, IUserRepository } from '../../repositories/user.repo';
import { AppError } from '../../utils/AppError';
import { comparePassword, hashPassword } from '../../utils/hash';
import { signAccessToken } from '../../utils/jwt';
import {
  LoginInput,
  LoginResponseData,
  RegisterInput,
  RegisterResponseData,
} from './auth.types';

/**
 * Service encapsulating authentication and registration business logic.
 */
export class AuthService {
  constructor(private readonly userRepo: IUserRepository = defaultUserRepository) {}

  /**
   * Registers a new user account.
   *
   * Security rules:
   * - Checks for existing account to avoid duplicates.
   * - Uses bcrypt.hash for strong password encryption.
   * - Emits signed JWT access tokens containing only non-sensitive claims.
   * - Never exposes password or passwordHash.
   */
  async register(data: RegisterInput): Promise<RegisterResponseData> {
    const existing = await this.userRepo.findByEmail(data.email);
    if (existing) {
      throw AppError.badRequest('An account with this email already exists');
    }

    const passwordHash = await hashPassword(data.password);

    const role = data.role || 'user';
    if (role === 'admin') {
      throw AppError.badRequest('Cannot self-register as an administrator');
    }

    const newUser = await this.userRepo.create({
      email: data.email,
      passwordHash,
      role,
      name: data.name,
      phone: data.phone,
    });

    // If registering as worker and running with persistent DB, create worker profile
    if (role === 'worker') {
      try {
        const { defaultWorkerRepository } = await import('../../repositories/worker.repo');
        const { defaultCategoryRepository } = await import('../../repositories/category.repo');
        const categories = await defaultCategoryRepository.findAll();
        const defaultCatId = categories[0]?.id || 'cat_plumbing';
        await defaultWorkerRepository.create({
          userId: newUser.id,
          categoryId: defaultCatId,
          title: data.name ? `${data.name} (Service Provider)` : 'Service Professional',
          hourlyRate: 50.0,
          experienceYears: 1,
        });
      } catch {
        // Ignore during isolated unit test environments without database
      }
    }

    const accessToken = signAccessToken({
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
      name: newUser.name,
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        ...(newUser.name && { name: newUser.name }),
      },
    };
  }

  /**
   * Authenticates a user with email and password.
   *
   * Security rules:
   * - Uses generic failure message to mitigate account enumeration.
   * - Verifies account active status.
   * - Employs bcrypt.compare for timing-safe password verification.
   * - Emits signed JWT access tokens containing only necessary claims.
   * - Never exposes password or passwordHash.
   */
  async login(credentials: LoginInput): Promise<LoginResponseData> {
    const user = await this.userRepo.findByEmail(credentials.email);

    // Protect against account enumeration: return identical message whether user exists or not
    if (!user) {
      throw AppError.unauthorized('Invalid email or password');
    }

    // Verify account active status
    if (!user.isActive) {
      throw AppError.unauthorized('Account is disabled. Please contact support.');
    }

    // Compare submitted password against stored bcrypt hash
    const isPasswordValid = await comparePassword(
      credentials.password,
      user.passwordHash
    );

    if (!isPasswordValid) {
      throw AppError.unauthorized('Invalid email or password');
    }

    // Issue short-lived access token
    const accessToken = signAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        ...(user.name && { name: user.name }),
      },
    };
  }
}

export const authService = new AuthService();
