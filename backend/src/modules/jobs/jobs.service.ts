import { defaultJobsRepository, IJobsRepository } from '../../repositories/jobs.repo';
import { defaultWorkerRepository, IWorkerRepository } from '../../repositories/worker.repo';
import { Booking } from '../../types/common.types';
import { AppError } from '../../utils/AppError';
import {
  JobFilterQuery,
  JobListResponseData,
  JobStatusHistoryEntry,
  SanitizedJobRequest,
  UpdateJobStatusInput,
} from './jobs.types';

export class JobsService {
  constructor(
    private readonly jobsRepo: IJobsRepository = defaultJobsRepository,
    private readonly workerRepo: IWorkerRepository = defaultWorkerRepository
  ) {}

  private async getWorkerByUserId(userId: string) {
    const worker = await this.workerRepo.findByUserId(userId);
    if (!worker) {
      throw AppError.notFound('Worker profile not found for this account');
    }
    return worker;
  }

  /**
   * API 14: GET /jobs/requests
   * Role: Worker
   * Retrieve service requests the authenticated worker is permitted to view.
   * Restricts results to worker's service category and assigned requests.
   * Sanitizes customer information to protect customer privacy.
   */
  async getJobRequests(userId: string, query: JobFilterQuery): Promise<JobListResponseData> {
    const worker = await this.getWorkerByUserId(userId);

    const rawRequests = await this.jobsRepo.findRequestsForWorker(
      worker.categoryId,
      worker.id,
      query.status
    );

    // Sanitize customer data (hide phone/email, provide high-level job info)
    const sanitized: SanitizedJobRequest[] = rawRequests.map((b) => ({
      id: b.id,
      categoryId: b.categoryId,
      categoryName: b.categoryName,
      serviceDescription: b.serviceDescription || b.notes,
      bookingDate: b.bookingDate,
      bookingTime: b.bookingTime,
      address: b.address,
      totalPrice: b.totalPrice,
      status: b.status,
      customerName: b.customerName,
      createdAt: b.createdAt,
    }));

    const page = query.page || 1;
    const limit = query.limit || 10;
    const offset = (page - 1) * limit;
    const paginated = sanitized.slice(offset, offset + limit);

    return {
      jobs: paginated,
      pagination: {
        page,
        limit,
        total: sanitized.length,
        totalPages: Math.ceil(sanitized.length / limit) || 1,
      },
    };
  }

  /**
   * API 15: GET /jobs/me
   * Role: Worker
   * Retrieve the authenticated worker's activities and assigned jobs.
   */
  async getMyJobs(userId: string, query: JobFilterQuery): Promise<JobListResponseData> {
    const worker = await this.getWorkerByUserId(userId);

    const allJobs = await this.jobsRepo.findJobsByWorkerId(worker.id, query.status);

    const page = query.page || 1;
    const limit = query.limit || 10;
    const offset = (page - 1) * limit;
    const paginated = allJobs.slice(offset, offset + limit);

    return {
      jobs: paginated,
      pagination: {
        page,
        limit,
        total: allJobs.length,
        totalPages: Math.ceil(allJobs.length / limit) || 1,
      },
    };
  }

  /**
   * API 16: GET /jobs/:id
   * Role: Worker
   * Retrieve details of a specific job with worker authorization check.
   */
  async getJobById(
    jobId: string,
    userId: string
  ): Promise<Booking & { statusHistory?: JobStatusHistoryEntry[] }> {
    const worker = await this.getWorkerByUserId(userId);

    const job = await this.jobsRepo.findById(jobId);
    if (!job) {
      throw AppError.notFound(`Job with ID '${jobId}' not found`);
    }

    // Verify authorized scope: must be assigned to worker or an open request in worker's category
    const isAssigned = job.workerId === worker.id;
    const isOpenCategoryRequest =
      job.categoryId === worker.categoryId && job.status.toLowerCase() === 'pending';

    if (!isAssigned && !isOpenCategoryRequest) {
      throw AppError.forbidden('You do not have permission to access this job');
    }

    const statusHistory = this.jobsRepo.getStatusHistory(jobId);

    return {
      ...job,
      statusHistory,
    };
  }

  /**
   * API 17: PATCH /jobs/:id/status
   * Role: Worker
   * Enforces strict state machine transitions for jobs.
   */
  async updateJobStatus(
    jobId: string,
    userId: string,
    input: UpdateJobStatusInput
  ): Promise<Booking & { statusHistory?: JobStatusHistoryEntry[] }> {
    const worker = await this.getWorkerByUserId(userId);

    const job = await this.jobsRepo.findById(jobId);
    if (!job) {
      throw AppError.notFound(`Job with ID '${jobId}' not found`);
    }

    if (job.workerId !== worker.id) {
      throw AppError.forbidden('You can only update the status of jobs assigned to you');
    }

    const currentStatus = job.status.toLowerCase();
    const targetStatus = input.status.toLowerCase();

    // Check terminal states
    if (['completed', 'cancelled', 'rejected'].includes(currentStatus)) {
      throw AppError.badRequest(
        `Job is in terminal status '${job.status}' and cannot be transitioned to '${input.status}'`
      );
    }

    // State machine transitions
    const validTransitions: Record<string, string[]> = {
      pending: ['accepted', 'confirmed', 'rejected'],
      accepted: ['in_progress', 'cancelled'],
      confirmed: ['in_progress', 'cancelled'],
      in_progress: ['completed', 'cancelled'],
    };

    const allowed = validTransitions[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw AppError.badRequest(
        `Invalid status transition from '${job.status}' to '${input.status}'. Allowed: ${allowed.join(', ')}`
      );
    }

    // Normalize status string for persistence
    const normalizedStatus =
      targetStatus === 'accepted' ? 'CONFIRMED' : targetStatus.toUpperCase();

    const updated = await this.jobsRepo.updateStatus(jobId, normalizedStatus, input.note);
    const statusHistory = this.jobsRepo.getStatusHistory(jobId);

    return {
      ...updated,
      statusHistory,
    };
  }
}

export const jobsService = new JobsService();
