import { defaultUserRepository, IUserRepository } from '../../repositories/user.repo';
import { AppError } from '../../utils/AppError';
import { comparePassword, hashPassword } from '../../utils/hash';
import {
  ChangePasswordInput,
  UpdateUserProfileInput,
  UserProfileResponseData,
} from './users.types';

export class UsersService {
  constructor(private readonly userRepo: IUserRepository = defaultUserRepository) {}

  /**
   * Fetch authenticated user's profile.
   * Never leaks passwordHash.
   */
  async getProfile(userId: string): Promise<UserProfileResponseData> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw AppError.notFound('User account not found');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...profile } = user;
    return profile;
  }

  /**
   * Update profile information.
   * Privilege escalation prevention: role and email cannot be updated through this endpoint.
   */
  async updateProfile(
    userId: string,
    input: UpdateUserProfileInput
  ): Promise<UserProfileResponseData> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw AppError.notFound('User account not found');
    }

    const avatarUrl = input.avatar_url || input.avatarUrl;

    const updated = await this.userRepo.update(userId, {
      name: input.name,
      phone: input.phone,
      avatarUrl,
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...profile } = updated;
    return profile;
  }

  /**
   * Change user password securely.
   */
  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw AppError.notFound('User account not found');
    }

    const currentPassword = (input.currentPassword || input.current_password) as string;
    const newPassword = (input.newPassword || input.new_password) as string;

    const isMatch = await comparePassword(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw AppError.badRequest('Current password is incorrect');
    }

    const newHash = await hashPassword(newPassword);
    await this.userRepo.update(userId, {
      passwordHash: newHash,
    });
  }
}

export const usersService = new UsersService();
