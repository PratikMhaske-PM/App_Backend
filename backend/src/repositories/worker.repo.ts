import { db } from '../config/database';
import { IDatabase } from '../database/sqlite';
import { WorkerProfile, WorkerStats } from '../types/common.types';
import { AppError } from '../utils/AppError';

export interface WorkerFilterOptions {
  categoryId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'rating' | 'hourly_rate' | 'experience_years' | 'created_at';
  order?: 'asc' | 'desc';
  onlyAvailable?: boolean;
}

interface WorkerRow {
  id: string;
  user_id: string;
  category_id: string;
  title: string;
  bio: string | null;
  hourly_rate: number;
  experience_years: number;
  is_available: number;
  availability_status: string;
  verification_status: string;
  rating_avg: number;
  reviews_count: number;
  location: string | null;
  created_at: string;
  updated_at: string;

  // Joined fields
  user_name?: string | null;
  user_email?: string | null;
  user_phone?: string | null;
  category_name?: string | null;
  category_slug?: string | null;
}

function mapWorkerRow(row: WorkerRow): WorkerProfile {
  return {
    id: row.id,
    userId: row.user_id,
    categoryId: row.category_id,
    title: row.title,
    bio: row.bio || undefined,
    hourlyRate: Number(row.hourly_rate),
    experienceYears: Number(row.experience_years),
    isAvailable: row.is_available === 1,
    availabilityStatus: row.availability_status as 'available' | 'busy' | 'offline',
    verificationStatus: row.verification_status as 'pending' | 'approved' | 'rejected',
    ratingAvg: Number(row.rating_avg),
    reviewsCount: Number(row.reviews_count),
    location: row.location || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    userName: row.user_name || undefined,
    userEmail: row.user_email || undefined,
    userPhone: row.user_phone || undefined,
    categoryName: row.category_name || undefined,
    categorySlug: row.category_slug || undefined,
  };
}

export interface IWorkerRepository {
  findMany(filters: WorkerFilterOptions): Promise<WorkerProfile[]>;
  count(filters: WorkerFilterOptions): Promise<number>;
  findById(id: string): Promise<WorkerProfile | null>;
  findByUserId(userId: string): Promise<WorkerProfile | null>;
  create(data: {
    userId: string;
    categoryId: string;
    title: string;
    bio?: string;
    hourlyRate: number;
    experienceYears?: number;
    location?: string;
  }): Promise<WorkerProfile>;
  updateProfile(
    id: string,
    updates: Partial<{
      title: string;
      bio: string;
      hourlyRate: number;
      experienceYears: number;
      categoryId: string;
      location: string;
      verificationStatus: 'pending' | 'approved' | 'rejected';
    }>
  ): Promise<WorkerProfile>;
  updateAvailability(
    id: string,
    isAvailable: boolean,
    availabilityStatus?: 'available' | 'busy' | 'offline'
  ): Promise<WorkerProfile>;
  updateRatingAndCount(
    id: string,
    ratingAvg: number,
    reviewsCount: number
  ): Promise<void>;
  getStats(workerId: string): Promise<WorkerStats>;
}

export class WorkerRepository implements IWorkerRepository {
  constructor(private readonly database: IDatabase = db) {}

  async findMany(filters: WorkerFilterOptions): Promise<WorkerProfile[]> {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(50, Math.max(1, filters.limit || 10));
    const offset = (page - 1) * limit;

    const whereClauses: string[] = ["w.verification_status = 'approved'"];
    const params: unknown[] = [];

    if (filters.categoryId) {
      whereClauses.push('w.category_id = ?');
      params.push(filters.categoryId);
    }

    if (filters.onlyAvailable) {
      whereClauses.push('w.is_available = 1');
    }

    if (filters.search) {
      const searchPattern = `%${filters.search.trim().toLowerCase()}%`;
      whereClauses.push('(LOWER(w.title) LIKE ? OR LOWER(w.bio) LIKE ? OR LOWER(u.name) LIKE ?)');
      params.push(searchPattern, searchPattern, searchPattern);
    }

    const sortColumnMap: Record<string, string> = {
      rating: 'w.rating_avg',
      hourly_rate: 'w.hourly_rate',
      experience_years: 'w.experience_years',
      created_at: 'w.created_at',
    };

    const sortCol = sortColumnMap[filters.sortBy || 'rating'] || 'w.rating_avg';
    const sortDir = (filters.order || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const sql = `
      SELECT 
        w.id, w.user_id, w.category_id, w.title, w.bio, w.hourly_rate, 
        w.experience_years, w.is_available, w.availability_status, 
        w.verification_status, w.rating_avg, w.reviews_count, w.location, 
        w.created_at, w.updated_at,
        u.name as user_name, u.email as user_email, u.phone as user_phone,
        c.name as category_name, c.slug as category_slug
      FROM workers w
      JOIN users u ON w.user_id = u.id
      JOIN categories c ON w.category_id = c.id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY ${sortCol} ${sortDir}
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);
    const rows = this.database.query<WorkerRow>(sql, params);
    return rows.map(mapWorkerRow);
  }

  async count(filters: WorkerFilterOptions): Promise<number> {
    const whereClauses: string[] = ["w.verification_status = 'approved'"];
    const params: unknown[] = [];

    if (filters.categoryId) {
      whereClauses.push('w.category_id = ?');
      params.push(filters.categoryId);
    }

    if (filters.onlyAvailable) {
      whereClauses.push('w.is_available = 1');
    }

    if (filters.search) {
      const searchPattern = `%${filters.search.trim().toLowerCase()}%`;
      whereClauses.push('(LOWER(w.title) LIKE ? OR LOWER(w.bio) LIKE ? OR LOWER(u.name) LIKE ?)');
      params.push(searchPattern, searchPattern, searchPattern);
    }

    const sql = `
      SELECT COUNT(*) as count
      FROM workers w
      JOIN users u ON w.user_id = u.id
      JOIN categories c ON w.category_id = c.id
      WHERE ${whereClauses.join(' AND ')}
    `;

    const row = this.database.queryOne<{ count: number }>(sql, params);
    return row ? Number(row.count) : 0;
  }

  async findById(id: string): Promise<WorkerProfile | null> {
    const sql = `
      SELECT 
        w.id, w.user_id, w.category_id, w.title, w.bio, w.hourly_rate, 
        w.experience_years, w.is_available, w.availability_status, 
        w.verification_status, w.rating_avg, w.reviews_count, w.location, 
        w.created_at, w.updated_at,
        u.name as user_name, u.email as user_email, u.phone as user_phone,
        c.name as category_name, c.slug as category_slug
      FROM workers w
      JOIN users u ON w.user_id = u.id
      JOIN categories c ON w.category_id = c.id
      WHERE w.id = ? OR w.user_id = ?
    `;

    const row = this.database.queryOne<WorkerRow>(sql, [id, id]);
    return row ? mapWorkerRow(row) : null;
  }

  async findByUserId(userId: string): Promise<WorkerProfile | null> {
    return this.findById(userId);
  }

  async create(data: {
    userId: string;
    categoryId: string;
    title: string;
    bio?: string;
    hourlyRate: number;
    experienceYears?: number;
    location?: string;
  }): Promise<WorkerProfile> {
    const existing = await this.findByUserId(data.userId);
    if (existing) {
      throw AppError.badRequest('A worker profile already exists for this user account');
    }

    const id = `wrk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    this.database.run(
      `INSERT INTO workers (
        id, user_id, category_id, title, bio, hourly_rate, experience_years, 
        is_available, availability_status, verification_status, rating_avg, 
        reviews_count, location, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.userId,
        data.categoryId,
        data.title,
        data.bio || null,
        data.hourlyRate,
        data.experienceYears || 0,
        1,
        'available',
        'approved',
        0.0,
        0,
        data.location || null,
        now,
        now,
      ]
    );

    const created = await this.findById(id);
    if (!created) {
      throw AppError.internal('Failed to create worker profile');
    }
    return created;
  }

  async updateProfile(
    id: string,
    updates: Partial<{
      title: string;
      bio: string;
      hourlyRate: number;
      experienceYears: number;
      categoryId: string;
      location: string;
      verificationStatus: 'pending' | 'approved' | 'rejected';
    }>
  ): Promise<WorkerProfile> {
    const existing = await this.findById(id);
    if (!existing) {
      throw AppError.notFound('Worker profile not found');
    }

    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (updates.title !== undefined) {
      setClauses.push('title = ?');
      params.push(updates.title);
    }
    if (updates.bio !== undefined) {
      setClauses.push('bio = ?');
      params.push(updates.bio);
    }
    if (updates.hourlyRate !== undefined) {
      setClauses.push('hourly_rate = ?');
      params.push(updates.hourlyRate);
    }
    if (updates.experienceYears !== undefined) {
      setClauses.push('experience_years = ?');
      params.push(updates.experienceYears);
    }
    if (updates.categoryId !== undefined) {
      setClauses.push('category_id = ?');
      params.push(updates.categoryId);
    }
    if (updates.location !== undefined) {
      setClauses.push('location = ?');
      params.push(updates.location);
    }
    if (updates.verificationStatus !== undefined) {
      setClauses.push('verification_status = ?');
      params.push(updates.verificationStatus);
    }

    if (setClauses.length > 0) {
      const now = new Date().toISOString();
      setClauses.push('updated_at = ?');
      params.push(now);

      params.push(existing.id);
      this.database.run(
        `UPDATE workers SET ${setClauses.join(', ')} WHERE id = ?`,
        params
      );
    }

    const updated = await this.findById(existing.id);
    if (!updated) {
      throw AppError.internal('Failed to retrieve updated worker profile');
    }
    return updated;
  }

  async updateAvailability(
    id: string,
    isAvailable: boolean,
    availabilityStatus?: 'available' | 'busy' | 'offline'
  ): Promise<WorkerProfile> {
    const existing = await this.findById(id);
    if (!existing) {
      throw AppError.notFound('Worker profile not found');
    }

    const now = new Date().toISOString();
    const status = availabilityStatus || (isAvailable ? 'available' : 'offline');

    this.database.run(
      'UPDATE workers SET is_available = ?, availability_status = ?, updated_at = ? WHERE id = ?',
      [isAvailable ? 1 : 0, status, now, existing.id]
    );

    const updated = await this.findById(existing.id);
    if (!updated) {
      throw AppError.internal('Failed to retrieve worker profile after availability update');
    }
    return updated;
  }

  async updateRatingAndCount(
    id: string,
    ratingAvg: number,
    reviewsCount: number
  ): Promise<void> {
    const now = new Date().toISOString();
    this.database.run(
      'UPDATE workers SET rating_avg = ?, reviews_count = ?, updated_at = ? WHERE id = ?',
      [ratingAvg, reviewsCount, now, id]
    );
  }

  async getStats(workerId: string): Promise<WorkerStats> {
    const worker = await this.findById(workerId);
    if (!worker) {
      throw AppError.notFound('Worker profile not found');
    }

    // Calculate stats using actual database records
    const bookingCounts = this.database.query<{ status: string; count: number; total_price: number }>(
      'SELECT status, COUNT(*) as count, SUM(total_price) as total_price FROM bookings WHERE worker_id = ? GROUP BY status',
      [worker.id]
    );

    let totalBookings = 0;
    let completedBookings = 0;
    let cancelledBookings = 0;
    let pendingBookings = 0;
    let confirmedBookings = 0;
    let totalEarnings = 0;

    for (const b of bookingCounts) {
      const c = Number(b.count || 0);
      totalBookings += c;
      if (b.status === 'completed') {
        completedBookings += c;
        totalEarnings += Number(b.total_price || 0);
      } else if (b.status === 'cancelled') {
        cancelledBookings += c;
      } else if (b.status === 'pending') {
        pendingBookings += c;
      } else if (b.status === 'confirmed') {
        confirmedBookings += c;
      }
    }

    const reviewCountRow = this.database.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM reviews WHERE worker_id = ?',
      [worker.id]
    );

    return {
      totalBookings,
      completedBookings,
      cancelledBookings,
      pendingBookings,
      confirmedBookings,
      totalEarnings,
      averageRating: worker.ratingAvg,
      totalReviews: reviewCountRow ? Number(reviewCountRow.count) : worker.reviewsCount,
    };
  }
}

export const defaultWorkerRepository: IWorkerRepository = new WorkerRepository();
