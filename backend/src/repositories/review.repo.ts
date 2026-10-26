import { db } from '../config/database';
import { IDatabase } from '../database/sqlite';
import { Review } from '../types/common.types';
import { AppError } from '../utils/AppError';

interface ReviewRow {
  id: string;
  booking_id: string;
  customer_id: string;
  worker_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;

  // Joined fields
  customer_name?: string | null;
  worker_title?: string | null;
}

function mapReviewRow(row: ReviewRow): Review {
  return {
    id: row.id,
    bookingId: row.booking_id,
    customerId: row.customer_id,
    workerId: row.worker_id,
    rating: Number(row.rating),
    comment: row.comment || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    customerName: row.customer_name || undefined,
    workerTitle: row.worker_title || undefined,
  };
}

export interface IReviewRepository {
  create(data: {
    bookingId: string;
    customerId: string;
    workerId: string;
    rating: number;
    comment?: string;
  }): Promise<Review>;
  findById(id: string): Promise<Review | null>;
  findByBookingId(bookingId: string): Promise<Review | null>;
  findByWorkerId(workerId: string, page?: number, limit?: number): Promise<Review[]>;
  countByWorkerId(workerId: string): Promise<number>;
  update(id: string, rating: number, comment?: string): Promise<Review>;
  delete(id: string): Promise<void>;
  calculateWorkerRating(workerId: string): Promise<{ ratingAvg: number; reviewsCount: number }>;
}

export class ReviewRepository implements IReviewRepository {
  constructor(private readonly database: IDatabase = db) {}

  async create(data: {
    bookingId: string;
    customerId: string;
    workerId: string;
    rating: number;
    comment?: string;
  }): Promise<Review> {
    const existing = await this.findByBookingId(data.bookingId);
    if (existing) {
      throw AppError.badRequest('A review has already been submitted for this booking');
    }

    const id = `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    this.database.run(
      `INSERT INTO reviews (id, booking_id, customer_id, worker_id, rating, comment, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.bookingId,
        data.customerId,
        data.workerId,
        data.rating,
        data.comment || null,
        now,
        now,
      ]
    );

    const created = await this.findById(id);
    if (!created) {
      throw AppError.internal('Failed to create review');
    }
    return created;
  }

  async findById(id: string): Promise<Review | null> {
    const sql = `
      SELECT 
        r.id, r.booking_id, r.customer_id, r.worker_id, r.rating, r.comment, 
        r.created_at, r.updated_at,
        u.name as customer_name,
        w.title as worker_title
      FROM reviews r
      JOIN users u ON r.customer_id = u.id
      JOIN workers w ON r.worker_id = w.id
      WHERE r.id = ?
    `;

    const row = this.database.queryOne<ReviewRow>(sql, [id]);
    return row ? mapReviewRow(row) : null;
  }

  async findByBookingId(bookingId: string): Promise<Review | null> {
    const sql = `
      SELECT 
        r.id, r.booking_id, r.customer_id, r.worker_id, r.rating, r.comment, 
        r.created_at, r.updated_at,
        u.name as customer_name,
        w.title as worker_title
      FROM reviews r
      JOIN users u ON r.customer_id = u.id
      JOIN workers w ON r.worker_id = w.id
      WHERE r.booking_id = ?
    `;

    const row = this.database.queryOne<ReviewRow>(sql, [bookingId]);
    return row ? mapReviewRow(row) : null;
  }

  async findByWorkerId(workerId: string, page: number = 1, limit: number = 10): Promise<Review[]> {
    const validPage = Math.max(1, page);
    const validLimit = Math.min(50, Math.max(1, limit));
    const offset = (validPage - 1) * validLimit;

    const sql = `
      SELECT 
        r.id, r.booking_id, r.customer_id, r.worker_id, r.rating, r.comment, 
        r.created_at, r.updated_at,
        u.name as customer_name,
        w.title as worker_title
      FROM reviews r
      JOIN users u ON r.customer_id = u.id
      JOIN workers w ON r.worker_id = w.id
      WHERE r.worker_id = ?
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const rows = this.database.query<ReviewRow>(sql, [workerId, validLimit, offset]);
    return rows.map(mapReviewRow);
  }

  async countByWorkerId(workerId: string): Promise<number> {
    const row = this.database.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM reviews WHERE worker_id = ?',
      [workerId]
    );
    return row ? Number(row.count) : 0;
  }

  async update(id: string, rating: number, comment?: string): Promise<Review> {
    const existing = await this.findById(id);
    if (!existing) {
      throw AppError.notFound('Review not found');
    }

    const now = new Date().toISOString();
    this.database.run(
      'UPDATE reviews SET rating = ?, comment = ?, updated_at = ? WHERE id = ?',
      [rating, comment !== undefined ? comment : null, now, id]
    );

    const updated = await this.findById(id);
    if (!updated) {
      throw AppError.internal('Failed to retrieve updated review');
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    const existing = await this.findById(id);
    if (!existing) {
      throw AppError.notFound('Review not found');
    }

    this.database.run('DELETE FROM reviews WHERE id = ?', [id]);
  }

  async calculateWorkerRating(workerId: string): Promise<{ ratingAvg: number; reviewsCount: number }> {
    const rows = this.database.query<{ rating: number }>(
      'SELECT rating FROM reviews WHERE worker_id = ?',
      [workerId]
    );

    if (rows.length === 0) {
      return { ratingAvg: 0.0, reviewsCount: 0 };
    }

    const total = rows.reduce((sum, r) => sum + Number(r.rating), 0);
    const avg = Math.round((total / rows.length) * 10) / 10;
    return {
      ratingAvg: avg,
      reviewsCount: rows.length,
    };
  }
}

export const defaultReviewRepository: IReviewRepository = new ReviewRepository();
