import { Booking } from '../../types/common.types';

export interface JobFilterQuery {
  status?: string;
  page?: number;
  limit?: number;
}

export interface UpdateJobStatusInput {
  status: string;
  note?: string;
}

export interface JobStatusHistoryEntry {
  status: string;
  timestamp: string;
  note?: string;
  updatedBy?: string;
}

export interface SanitizedJobRequest {
  id: string;
  categoryId: string;
  categoryName?: string;
  serviceDescription?: string;
  bookingDate: string;
  bookingTime?: string;
  address: string;
  totalPrice?: number;
  status: string;
  customerName?: string;
  createdAt: string;
}

export interface JobListResponseData {
  jobs: Booking[] | SanitizedJobRequest[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
