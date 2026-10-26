import { WorkerProfile } from '../../types/common.types';

export interface AdminWorkerListResponseData {
  workers: WorkerProfile[];
  total: number;
}

export interface VerifyWorkerInput {
  status: 'pending' | 'approved' | 'rejected';
}

export interface AdminSystemStatsResponseData {
  totalUsers: number;
  totalWorkers: number;
  totalBookings: number;
  completedBookings: number;
  totalRevenue: number;
}
