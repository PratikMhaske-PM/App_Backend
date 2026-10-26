import { Review, WorkerProfile, WorkerStats } from '../../types/common.types';

export interface WorkerListResponseData {
  workers: WorkerProfile[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface WorkerReviewsResponseData {
  reviews: Review[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UpdateAvailabilityInput {
  is_available?: boolean;
  isAvailable?: boolean;
  availability_status?: 'available' | 'busy' | 'offline';
  availabilityStatus?: 'available' | 'busy' | 'offline';
}

export interface UpdateWorkerProfileInput {
  title?: string;
  bio?: string;
  hourly_rate?: number;
  hourlyRate?: number;
  experience_years?: number;
  experienceYears?: number;
  category_id?: string;
  categoryId?: string;
  location?: string;
}

export type WorkerStatsResponseData = WorkerStats;
