import { db } from '../config/database';
import { IDatabase } from '../database/sqlite';
import { Booking } from '../types/common.types';
import { AppError } from '../utils/AppError';

export interface BookingFilterOptions {
  customerId?: string;
  workerId?: string;
  categoryId?: string;
  status?: string;
  page?: number;
  limit?: number;
  sortBy?: 'booking_date' | 'created_at';
  order?: 'asc' | 'desc';
}

export interface CreateBookingRepoData {
  customerId: string;
  workerId: string;
  categoryId: string;
  serviceDescription?: string;
  bookingDate: string;
  bookingTime?: string;
  address: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  totalPrice?: number;
}

interface BookingRow {
  id: string;
  customer_id: string;
  worker_id: string;
  category_id: string;
  service_description?: string | null;
  booking_date: string;
  booking_time?: string | null;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  status: string;
  notes: string | null;
  total_price: number | null;
  cancellation_reason: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;

  // Joined fields
  customer_name?: string | null;
  customer_email?: string | null;
  customer_phone?: string | null;
  worker_title?: string | null;
  worker_name?: string | null;
  worker_phone?: string | null;
  category_name?: string | null;
  category_slug?: string | null;
}

function mapBookingRow(row: BookingRow): Booking {
  return {
    id: row.id,
    customerId: row.customer_id,
    workerId: row.worker_id,
    categoryId: row.category_id,
    serviceDescription: row.service_description || row.notes || undefined,
    bookingDate: row.booking_date,
    bookingTime: row.booking_time || undefined,
    address: row.address,
    latitude: row.latitude !== null && row.latitude !== undefined ? Number(row.latitude) : undefined,
    longitude: row.longitude !== null && row.longitude !== undefined ? Number(row.longitude) : undefined,
    status: row.status,
    notes: row.notes || row.service_description || undefined,
    totalPrice: row.total_price !== null && row.total_price !== undefined ? Number(row.total_price) : undefined,
    cancellationReason: row.cancellation_reason || undefined,
    cancelledAt: row.cancelled_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    customerName: row.customer_name || undefined,
    customerEmail: row.customer_email || undefined,
    customerPhone: row.customer_phone || undefined,
    workerTitle: row.worker_title || undefined,
    workerName: row.worker_name || undefined,
    workerPhone: row.worker_phone || undefined,
    categoryName: row.category_name || undefined,
    categorySlug: row.category_slug || undefined,
  };
}

export interface IBookingRepository {
  create(data: CreateBookingRepoData): Promise<Booking>;
  findById(id: string): Promise<Booking | null>;
  findMany(filters: BookingFilterOptions): Promise<Booking[]>;
  count(filters: BookingFilterOptions): Promise<number>;
  updateStatus(
    id: string,
    status: string,
    reason?: string,
    cancelledAt?: string
  ): Promise<Booking>;
  findOverlapping(
    workerId: string,
    bookingDate: string,
    bookingTime?: string,
    excludeBookingId?: string
  ): Promise<Booking | null>;
  findDuplicatePending(
    customerId: string,
    workerId: string,
    bookingDate: string,
    bookingTime?: string
  ): Promise<Booking | null>;
}

export class BookingRepository implements IBookingRepository {
  constructor(private readonly database: IDatabase = db) {}

  async create(data: CreateBookingRepoData): Promise<Booking> {
    const id = `bkg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const serviceDesc = data.serviceDescription || data.notes || null;

    this.database.run(
      `INSERT INTO bookings (
        id, customer_id, worker_id, category_id, service_description, booking_date, 
        booking_time, address, latitude, longitude, status, notes, total_price, 
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.customerId,
        data.workerId,
        data.categoryId,
        serviceDesc,
        data.bookingDate,
        data.bookingTime || null,
        data.address,
        data.latitude !== undefined ? data.latitude : null,
        data.longitude !== undefined ? data.longitude : null,
        'PENDING',
        serviceDesc,
        data.totalPrice !== undefined ? data.totalPrice : null,
        now,
        now,
      ]
    );

    const created = await this.findById(id);
    if (!created) {
      throw AppError.internal('Failed to create booking record');
    }
    return created;
  }

  async findById(id: string): Promise<Booking | null> {
    const sql = `
      SELECT 
        b.id, b.customer_id, b.worker_id, b.category_id, b.service_description,
        b.booking_date, b.booking_time, b.status, b.notes, b.total_price, 
        b.address, b.latitude, b.longitude, b.cancellation_reason, b.cancelled_at,
        b.created_at, b.updated_at,
        u_cust.name as customer_name, u_cust.email as customer_email, u_cust.phone as customer_phone,
        w.title as worker_title, u_wrk.name as worker_name, u_wrk.phone as worker_phone,
        c.name as category_name, c.slug as category_slug
      FROM bookings b
      JOIN users u_cust ON b.customer_id = u_cust.id
      JOIN workers w ON b.worker_id = w.id
      JOIN users u_wrk ON w.user_id = u_wrk.id
      JOIN categories c ON b.category_id = c.id
      WHERE b.id = ?
    `;

    const row = this.database.queryOne<BookingRow>(sql, [id]);
    return row ? mapBookingRow(row) : null;
  }

  async findMany(filters: BookingFilterOptions): Promise<Booking[]> {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(50, Math.max(1, filters.limit || 10));
    const offset = (page - 1) * limit;

    const whereClauses: string[] = ['1=1'];
    const params: unknown[] = [];

    if (filters.customerId) {
      whereClauses.push('b.customer_id = ?');
      params.push(filters.customerId);
    }

    if (filters.workerId) {
      whereClauses.push('b.worker_id = ?');
      params.push(filters.workerId);
    }

    if (filters.categoryId) {
      whereClauses.push('b.category_id = ?');
      params.push(filters.categoryId);
    }

    if (filters.status) {
      // Support case-insensitive status matching (e.g. 'PENDING' or 'pending')
      whereClauses.push('LOWER(b.status) = LOWER(?)');
      params.push(filters.status.trim());
    }

    const sortCol = filters.sortBy === 'created_at' ? 'b.created_at' : 'b.booking_date';
    const sortDir = (filters.order || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const sql = `
      SELECT 
        b.id, b.customer_id, b.worker_id, b.category_id, b.service_description,
        b.booking_date, b.booking_time, b.status, b.notes, b.total_price, 
        b.address, b.latitude, b.longitude, b.cancellation_reason, b.cancelled_at,
        b.created_at, b.updated_at,
        u_cust.name as customer_name, u_cust.email as customer_email, u_cust.phone as customer_phone,
        w.title as worker_title, u_wrk.name as worker_name, u_wrk.phone as worker_phone,
        c.name as category_name, c.slug as category_slug
      FROM bookings b
      JOIN users u_cust ON b.customer_id = u_cust.id
      JOIN workers w ON b.worker_id = w.id
      JOIN users u_wrk ON w.user_id = u_wrk.id
      JOIN categories c ON b.category_id = c.id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY ${sortCol} ${sortDir}
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);
    const rows = this.database.query<BookingRow>(sql, params);
    return rows.map(mapBookingRow);
  }

  async count(filters: BookingFilterOptions): Promise<number> {
    const whereClauses: string[] = ['1=1'];
    const params: unknown[] = [];

    if (filters.customerId) {
      whereClauses.push('customer_id = ?');
      params.push(filters.customerId);
    }

    if (filters.workerId) {
      whereClauses.push('worker_id = ?');
      params.push(filters.workerId);
    }

    if (filters.categoryId) {
      whereClauses.push('category_id = ?');
      params.push(filters.categoryId);
    }

    if (filters.status) {
      whereClauses.push('LOWER(status) = LOWER(?)');
      params.push(filters.status.trim());
    }

    const sql = `
      SELECT COUNT(*) as count
      FROM bookings
      WHERE ${whereClauses.join(' AND ')}
    `;

    const row = this.database.queryOne<{ count: number }>(sql, params);
    return row ? Number(row.count) : 0;
  }

  async updateStatus(
    id: string,
    status: string,
    reason?: string,
    cancelledAt?: string
  ): Promise<Booking> {
    const existing = await this.findById(id);
    if (!existing) {
      throw AppError.notFound('Booking not found');
    }

    const now = new Date().toISOString();
    const setClauses = ['status = ?', 'updated_at = ?'];
    const params: unknown[] = [status, now];

    if (reason !== undefined) {
      setClauses.push('cancellation_reason = ?');
      params.push(reason);
    }

    if (cancelledAt !== undefined) {
      setClauses.push('cancelled_at = ?');
      params.push(cancelledAt);
    }

    params.push(id);
    this.database.run(
      `UPDATE bookings SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );

    const updated = await this.findById(id);
    if (!updated) {
      throw AppError.internal('Failed to retrieve updated booking record');
    }
    return updated;
  }

  async findOverlapping(
    workerId: string,
    bookingDate: string,
    bookingTime?: string,
    excludeBookingId?: string
  ): Promise<Booking | null> {
    const whereClauses = [
      'worker_id = ?',
      'booking_date = ?',
      "LOWER(status) = 'confirmed'",
    ];
    const params: unknown[] = [workerId, bookingDate];

    if (bookingTime) {
      whereClauses.push('booking_time = ?');
      params.push(bookingTime);
    }

    if (excludeBookingId) {
      whereClauses.push('id != ?');
      params.push(excludeBookingId);
    }

    const sql = `
      SELECT * FROM bookings 
      WHERE ${whereClauses.join(' AND ')}
      LIMIT 1
    `;

    const row = this.database.queryOne<BookingRow>(sql, params);
    return row ? mapBookingRow(row) : null;
  }

  async findDuplicatePending(
    customerId: string,
    workerId: string,
    bookingDate: string,
    bookingTime?: string
  ): Promise<Booking | null> {
    const whereClauses = [
      'customer_id = ?',
      'worker_id = ?',
      'booking_date = ?',
      "LOWER(status) = 'pending'",
    ];
    const params: unknown[] = [customerId, workerId, bookingDate];

    if (bookingTime) {
      whereClauses.push('booking_time = ?');
      params.push(bookingTime);
    }

    const sql = `
      SELECT * FROM bookings 
      WHERE ${whereClauses.join(' AND ')}
      LIMIT 1
    `;

    const row = this.database.queryOne<BookingRow>(sql, params);
    return row ? mapBookingRow(row) : null;
  }
}

export const defaultBookingRepository: IBookingRepository = new BookingRepository();
