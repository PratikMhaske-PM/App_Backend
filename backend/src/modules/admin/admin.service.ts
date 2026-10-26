import { db } from '../../config/database';
import { IDatabase } from '../../database/sqlite';
import { defaultWorkerRepository, IWorkerRepository } from '../../repositories/worker.repo';
import { WorkerProfile } from '../../types/common.types';
import { AppError } from '../../utils/AppError';
import {
  AdminSystemStatsResponseData,
  AdminWorkerListResponseData,
  VerifyWorkerInput,
} from './admin.types';

export class AdminService {
  constructor(
    private readonly workerRepo: IWorkerRepository = defaultWorkerRepository,
    private readonly database: IDatabase = db
  ) {}

  /**
   * List all workers across all verification statuses for administrative review.
   */
  async getAllWorkers(): Promise<AdminWorkerListResponseData> {
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
      ORDER BY w.created_at DESC
    `;

    interface WorkerAdminRow {
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
      user_name?: string | null;
      user_email?: string | null;
      user_phone?: string | null;
      category_name?: string | null;
      category_slug?: string | null;
    }

    const rows = this.database.query<WorkerAdminRow>(sql);
    const workers: WorkerProfile[] = rows.map((row) => ({
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
    }));

    return {
      workers,
      total: workers.length,
    };
  }

  /**
   * Approve or reject a worker profile.
   */
  async verifyWorker(id: string, input: VerifyWorkerInput): Promise<WorkerProfile> {
    const worker = await this.workerRepo.findById(id);
    if (!worker) {
      throw AppError.notFound(`Worker with ID '${id}' not found`);
    }

    return this.workerRepo.updateProfile(worker.id, {
      verificationStatus: input.status,
    });
  }

  /**
   * System overview statistics for administrators.
   */
  async getSystemStats(): Promise<AdminSystemStatsResponseData> {
    const userCount = this.database.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM users'
    );
    const workerCount = this.database.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM workers'
    );
    const bookingStats = this.database.queryOne<{ total: number; completed: number; revenue: number }>(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN total_price ELSE 0 END), 0) as revenue
       FROM bookings`
    );

    return {
      totalUsers: userCount ? Number(userCount.count) : 0,
      totalWorkers: workerCount ? Number(workerCount.count) : 0,
      totalBookings: bookingStats ? Number(bookingStats.total) : 0,
      completedBookings: bookingStats ? Number(bookingStats.completed) : 0,
      totalRevenue: bookingStats ? Number(bookingStats.revenue) : 0,
    };
  }
}

export const adminService = new AdminService();
