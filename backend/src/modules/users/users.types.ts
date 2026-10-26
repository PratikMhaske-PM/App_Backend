import { UserAccount } from '../../types/common.types';

export type UserProfileResponseData = Omit<UserAccount, 'passwordHash'>;

export interface UpdateUserProfileInput {
  name?: string;
  phone?: string;
  avatar_url?: string;
  avatarUrl?: string;
}

export interface ChangePasswordInput {
  currentPassword?: string;
  current_password?: string;
  newPassword?: string;
  new_password?: string;
}
