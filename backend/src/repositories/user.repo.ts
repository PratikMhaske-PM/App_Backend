import bcrypt from 'bcrypt';
import { db } from '../config/database';
import { IDatabase } from '../database/sqlite';
import { UserAccount } from '../types/common.types';
import { AppError } from '../utils/AppError';

/**
 * Interface defining contract for user account retrieval and persistence.
 * Decouples domain logic from database systems (SQLite, PostgreSQL, etc.).
 */
export interface IUserRepository {
  findByEmail(email: string): Promise<UserAccount | null>;
  findById(id: string): Promise<UserAccount | null>;
  create(userData: {
    email: string;
    passwordHash: string;
    role?: string;
    name?: string;
    phone?: string;
    avatarUrl?: string;
  }): Promise<UserAccount>;
  update(
    id: string,
    updates: Partial<{
      name: string;
      phone: string;
      avatarUrl: string;
      passwordHash: string;
      isActive: boolean;
    }>
  ): Promise<UserAccount>;
}

interface UserDbRow {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  name: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

function mapUserRow(row: UserDbRow): UserAccount {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    name: row.name || undefined,
    phone: row.phone || undefined,
    avatarUrl: row.avatar_url || undefined,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * SQLite User Repository implementing parameterized queries and foreign key support.
 */
export class SqliteUserRepository implements IUserRepository {
  constructor(private readonly database: IDatabase = db) {}

  async findByEmail(email: string): Promise<UserAccount | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const row = this.database.queryOne<UserDbRow>(
      'SELECT id, email, password_hash, role, name, phone, avatar_url, is_active, created_at, updated_at FROM users WHERE email = ?',
      [normalizedEmail]
    );

    return row ? mapUserRow(row) : null;
  }

  async findById(id: string): Promise<UserAccount | null> {
    const row = this.database.queryOne<UserDbRow>(
      'SELECT id, email, password_hash, role, name, phone, avatar_url, is_active, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );

    return row ? mapUserRow(row) : null;
  }

  async create(userData: {
    email: string;
    passwordHash: string;
    role?: string;
    name?: string;
    phone?: string;
    avatarUrl?: string;
  }): Promise<UserAccount> {
    const normalizedEmail = userData.email.trim().toLowerCase();

    // Verify uniqueness
    const existing = await this.findByEmail(normalizedEmail);
    if (existing) {
      throw AppError.badRequest('An account with this email already exists');
    }

    const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const role = userData.role || 'customer';

    this.database.run(
      'INSERT INTO users (id, email, password_hash, role, name, phone, avatar_url, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        normalizedEmail,
        userData.passwordHash,
        role,
        userData.name || null,
        userData.phone || null,
        userData.avatarUrl || null,
        1,
        now,
        now,
      ]
    );

    return {
      id,
      email: normalizedEmail,
      passwordHash: userData.passwordHash,
      role,
      name: userData.name,
      phone: userData.phone,
      avatarUrl: userData.avatarUrl,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
  }

  async update(
    id: string,
    updates: Partial<{
      name: string;
      phone: string;
      avatarUrl: string;
      passwordHash: string;
      isActive: boolean;
    }>
  ): Promise<UserAccount> {
    const existing = await this.findById(id);
    if (!existing) {
      throw AppError.notFound('User not found');
    }

    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      params.push(updates.name);
    }
    if (updates.phone !== undefined) {
      setClauses.push('phone = ?');
      params.push(updates.phone);
    }
    if (updates.avatarUrl !== undefined) {
      setClauses.push('avatar_url = ?');
      params.push(updates.avatarUrl);
    }
    if (updates.passwordHash !== undefined) {
      setClauses.push('password_hash = ?');
      params.push(updates.passwordHash);
    }
    if (updates.isActive !== undefined) {
      setClauses.push('is_active = ?');
      params.push(updates.isActive ? 1 : 0);
    }

    if (setClauses.length > 0) {
      const now = new Date().toISOString();
      setClauses.push('updated_at = ?');
      params.push(now);

      params.push(id);
      this.database.run(
        `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`,
        params
      );
    }

    const updated = await this.findById(id);
    if (!updated) {
      throw AppError.internal('Failed to retrieve updated user profile');
    }
    return updated;
  }
}

/**
 * In-memory user repository for isolated testing.
 */
export class InMemoryUserRepository implements IUserRepository {
  private users: Map<string, UserAccount> = new Map();

  constructor() {
    this.seedDefaultUser();
  }

  private seedDefaultUser(): void {
    const defaultPasswordHash = bcrypt.hashSync('Password123!', 10);
    const demoUser: UserAccount = {
      id: 'usr_demo_1',
      email: 'user@example.com',
      passwordHash: defaultPasswordHash,
      role: 'customer',
      name: 'Demo User',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.users.set(demoUser.email.toLowerCase(), demoUser);
  }

  async findByEmail(email: string): Promise<UserAccount | null> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = this.users.get(normalizedEmail);
    return user ? { ...user } : null;
  }

  async findById(id: string): Promise<UserAccount | null> {
    for (const user of this.users.values()) {
      if (user.id === id) {
        return { ...user };
      }
    }
    return null;
  }

  async create(userData: {
    email: string;
    passwordHash: string;
    role?: string;
    name?: string;
    phone?: string;
    avatarUrl?: string;
  }): Promise<UserAccount> {
    const normalizedEmail = userData.email.trim().toLowerCase();

    if (this.users.has(normalizedEmail)) {
      throw AppError.badRequest('An account with this email already exists');
    }

    const newUser: UserAccount = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      email: normalizedEmail,
      passwordHash: userData.passwordHash,
      role: userData.role || 'customer',
      name: userData.name,
      phone: userData.phone,
      avatarUrl: userData.avatarUrl,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.users.set(normalizedEmail, newUser);
    return { ...newUser };
  }

  async update(
    id: string,
    updates: Partial<{
      name: string;
      phone: string;
      avatarUrl: string;
      passwordHash: string;
      isActive: boolean;
    }>
  ): Promise<UserAccount> {
    const user = await this.findById(id);
    if (!user) {
      throw AppError.notFound('User not found');
    }

    const updatedUser: UserAccount = {
      ...user,
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.phone !== undefined && { phone: updates.phone }),
      ...(updates.avatarUrl !== undefined && { avatarUrl: updates.avatarUrl }),
      ...(updates.passwordHash !== undefined && { passwordHash: updates.passwordHash }),
      ...(updates.isActive !== undefined && { isActive: updates.isActive }),
      updatedAt: new Date().toISOString(),
    };

    this.users.set(user.email.toLowerCase(), updatedUser);
    return { ...updatedUser };
  }
}

/**
 * Placeholder pending database repository.
 */
export class PendingUserRepository implements IUserRepository {
  async findByEmail(_email: string): Promise<UserAccount | null> {
    throw new AppError(
      'Account provider is not configured. Database integration is pending.',
      500
    );
  }

  async findById(_id: string): Promise<UserAccount | null> {
    throw new AppError(
      'Account provider is not configured. Database integration is pending.',
      500
    );
  }

  async create(_userData: {
    email: string;
    passwordHash: string;
    role?: string;
    name?: string;
    phone?: string;
    avatarUrl?: string;
  }): Promise<UserAccount> {
    throw new AppError(
      'Account provider is not configured. Database integration is pending.',
      500
    );
  }

  async update(
    _id: string,
    _updates: Partial<{
      name: string;
      phone: string;
      avatarUrl: string;
      passwordHash: string;
      isActive: boolean;
    }>
  ): Promise<UserAccount> {
    throw new AppError(
      'Account provider is not configured. Database integration is pending.',
      500
    );
  }
}

/**
 * Default instance: SQLite repository connected to SQLite database.
 */
export const defaultUserRepository: IUserRepository = new SqliteUserRepository();
