import { SosAlert } from '../../types/common.types';

export interface CreateSosInput {
  emergency_type?: string;
  emergencyType?: string;
  latitude?: number;
  longitude?: number;
  booking_id?: string;
  bookingId?: string;
  notes?: string;
}

export interface SosResponseData {
  alert: SosAlert;
  message: string;
  disclaimer: string;
}
