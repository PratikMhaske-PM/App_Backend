import { Booking } from '../types/common.types';
import { defaultBookingRepository, IBookingRepository } from './booking.repo';

/**
 * In-memory Mock Jobs Repository Interface.
 * Independent of persistence storage, providing fast mock access for development and testing.
 */
export interface IJobsRepository {
  findRequestsForWorker(categoryId: string, workerId: string, status?: string): Promise<Booking[]>;
  findJobsByWorkerId(workerId: string, status?: string): Promise<Booking[]>;
  findById(id: string): Promise<Booking | null>;
  updateStatus(id: string, status: string, note?: string): Promise<Booking>;
  getStatusHistory(id: string): Array<{ status: string; timestamp: string; note?: string }>;
}

export class InMemoryJobsRepository implements IJobsRepository {
  private historyMap = new Map<string, Array<{ status: string; timestamp: string; note?: string }>>();
  private jobStatusMap = new Map<string, string>();

  constructor(private readonly bookingRepo: IBookingRepository = defaultBookingRepository) {}

  private overlayStatus(booking: Booking): Booking {
    const customStatus = this.jobStatusMap.get(booking.id);
    return customStatus ? { ...booking, status: customStatus } : booking;
  }

  async findRequestsForWorker(categoryId: string, workerId: string, status?: string): Promise<Booking[]> {
    const all = await this.bookingRepo.findMany({ categoryId, status });
    // Filter to requests that either belong to this worker or are open pending in this category
    return all
      .filter((b) => b.workerId === workerId || b.status.toLowerCase() === 'pending')
      .map((b) => this.overlayStatus(b));
  }

  async findJobsByWorkerId(workerId: string, status?: string): Promise<Booking[]> {
    const jobs = await this.bookingRepo.findMany({ workerId, status });
    return jobs.map((b) => this.overlayStatus(b));
  }

  async findById(id: string): Promise<Booking | null> {
    const booking = await this.bookingRepo.findById(id);
    return booking ? this.overlayStatus(booking) : null;
  }

  async updateStatus(id: string, status: string, note?: string): Promise<Booking> {
    this.jobStatusMap.set(id, status);

    // Map in_progress to CONFIRMED for SQLite database CHECK constraint compliance
    const dbStatus = status.toLowerCase() === 'in_progress' ? 'CONFIRMED' : status;
    const updated = await this.bookingRepo.updateStatus(id, dbStatus);

    const history = this.historyMap.get(id) || [];
    history.push({
      status,
      timestamp: new Date().toISOString(),
      note,
    });
    this.historyMap.set(id, history);
    return { ...updated, status };
  }

  getStatusHistory(id: string): Array<{ status: string; timestamp: string; note?: string }> {
    return this.historyMap.get(id) || [];
  }
}

export const defaultJobsRepository: IJobsRepository = new InMemoryJobsRepository();
