/**
 * Domain representation of an SOS request.
 */
export interface SosRequest {
  id: string;
  userId: string;
  message: string;
  latitude?: number;
  longitude?: number;
  status: 'active' | 'resolved';
  createdAt: string;
  updatedAt: string;
}

export interface CreateSosInput {
  message: string;
  latitude?: number;
  longitude?: number;
}
