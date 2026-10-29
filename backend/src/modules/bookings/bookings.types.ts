import { Booking } from '../../types/common.types';
import { QrCodeResult } from '../../utils/qr';

export interface CreateBookingInput {
  worker_id?: string;
  workerId?: string;
  category_id?: string;
  categoryId?: string;
  service_description?: string;
  serviceDescription?: string;
  booking_date?: string;
  bookingDate?: string;
  booking_time?: string;
  bookingTime?: string;
  address: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  total_price?: number;
  totalPrice?: number;
}

export interface GetMyBookingsQuery {
  status?: string;
  page?: number;
  limit?: number;
}

export interface BookingListResponseData {
  bookings: Booking[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CancelBookingInput {
  cancellation_reason?: string;
  cancellationReason?: string;
}

export interface VerifyQrInput {
  verification_code?: string;
  verificationCode?: string;
  token?: string;
  code?: string;
  qrPayload?: {
    bookingId?: string;
    customerId?: string;
    workerId?: string;
    verificationHash?: string;
  };
}

export type BookingQrResponseData = QrCodeResult;
