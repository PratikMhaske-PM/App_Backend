import { defaultCategoryRepository, ICategoryRepository } from '../../repositories/category.repo';
import { defaultReviewRepository, IReviewRepository } from '../../repositories/review.repo';
import { defaultWorkerRepository, IWorkerRepository } from '../../repositories/worker.repo';
import { WorkerProfile } from '../../types/common.types';
import { AppError } from '../../utils/AppError';
import {
  UpdateAvailabilityInput,
  UpdateWorkerProfileInput,
  WorkerListResponseData,
  WorkerReviewsResponseData,
  WorkerStatsResponseData,
} from './workers.types';
import { WorkerListQuery } from './workers.validation';

export class WorkersService {
  constructor(
    private readonly workerRepo: IWorkerRepository = defaultWorkerRepository,
    private readonly reviewRepo: IReviewRepository = defaultReviewRepository,
    private readonly categoryRepo: ICategoryRepository = defaultCategoryRepository
  ) {}

  /**
   * Search and filter workers with pagination.
   */
  async getWorkers(query: WorkerListQuery): Promise<WorkerListResponseData> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const categoryId = query.category_id || query.categoryId;

    const [workers, total] = await Promise.all([
      this.workerRepo.findMany({
        categoryId,
        search: query.search,
        page,
        limit,
        sortBy: query.sort_by,
        order: query.order,
      }),
      this.workerRepo.count({
        categoryId,
        search: query.search,
      }),
    ]);

    return {
      workers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Fetch worker details. Excludes sensitive user data.
   */
  async getWorkerById(id: string): Promise<WorkerProfile> {
    const worker = await this.workerRepo.findById(id);
    if (!worker) {
      throw AppError.notFound(`Worker with ID '${id}' not found`);
    }
    return worker;
  }

  /**
   * Fetch worker reviews with pagination.
   */
  async getWorkerReviews(
    workerId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<WorkerReviewsResponseData> {
    const worker = await this.workerRepo.findById(workerId);
    if (!worker) {
      throw AppError.notFound(`Worker with ID '${workerId}' not found`);
    }

    const [reviews, total] = await Promise.all([
      this.reviewRepo.findByWorkerId(worker.id, page, limit),
      this.reviewRepo.countByWorkerId(worker.id),
    ]);

    return {
      reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Allow authenticated worker to update their availability.
   * Validates worker identity using the authenticated user ID.
   */
  async updateAvailability(
    userId: string,
    input: UpdateAvailabilityInput
  ): Promise<WorkerProfile> {
    const worker = await this.workerRepo.findByUserId(userId);
    if (!worker) {
      throw AppError.notFound('Worker profile not found for this user account');
    }

    const isAvailable =
      input.is_available !== undefined
        ? input.is_available
        : input.isAvailable !== undefined
        ? input.isAvailable
        : worker.isAvailable;

    const availabilityStatus =
      input.availability_status ||
      input.availabilityStatus ||
      (isAvailable ? 'available' : 'offline');

    return this.workerRepo.updateAvailability(
      worker.id,
      isAvailable,
      availabilityStatus
    );
  }

  /**
   * Fetch statistics for the authenticated worker.
   */
  async getWorkerStats(userId: string): Promise<WorkerStatsResponseData> {
    const worker = await this.workerRepo.findByUserId(userId);
    if (!worker) {
      throw AppError.notFound('Worker profile not found for this user account');
    }

    return this.workerRepo.getStats(worker.id);
  }

  /**
   * Fetch profile for authenticated worker.
   */
  async getMyProfile(userId: string): Promise<WorkerProfile> {
    const worker = await this.workerRepo.findByUserId(userId);
    if (!worker) {
      throw AppError.notFound('Worker profile not found for this user account');
    }
    return worker;
  }

  /**
   * Update profile for authenticated worker.
   * Validates resource ownership (workers can only update their own profile).
   */
  async updateMyProfile(
    userId: string,
    input: UpdateWorkerProfileInput
  ): Promise<WorkerProfile> {
    const worker = await this.workerRepo.findByUserId(userId);
    if (!worker) {
      throw AppError.notFound('Worker profile not found for this user account');
    }

    const categoryId = input.category_id || input.categoryId;
    if (categoryId) {
      const category = await this.categoryRepo.findById(categoryId);
      if (!category) {
        throw AppError.badRequest(`Category '${categoryId}' does not exist`);
      }
    }

    const hourlyRate =
      input.hourly_rate !== undefined ? input.hourly_rate : input.hourlyRate;
    const experienceYears =
      input.experience_years !== undefined
        ? input.experience_years
        : input.experienceYears;

    return this.workerRepo.updateProfile(worker.id, {
      title: input.title,
      bio: input.bio,
      hourlyRate,
      experienceYears,
      categoryId,
      location: input.location,
    });
  }
}

export const workersService = new WorkersService();
