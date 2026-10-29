import { defaultSosRepository, ISosRepository } from '../../repositories/sos.repo';
import { AppError } from '../../utils/AppError';
import { CreateSosInput, SosResponseData } from './sos.types';

export class SosService {
  constructor(private readonly sosRepo: ISosRepository = defaultSosRepository) {}

  /**
   * API 29: POST /sos
   * Role: All authenticated users
   * Dispatches emergency alert with rate-limiting and duplicate prevention.
   */
  async createAlert(userId: string, input: CreateSosInput): Promise<SosResponseData> {
    // Prevent accidental duplicate submissions within 30 seconds
    const recent = await this.sosRepo.findRecentByUser(userId, 30);
    if (recent) {
      throw AppError.conflict(
        'An emergency SOS alert was already submitted recently. Emergency response is active.'
      );
    }

    const emergencyType = (input.emergency_type || input.emergencyType) as string;
    const bookingId = input.booking_id || input.bookingId;

    const alert = await this.sosRepo.create({
      userId,
      emergencyType,
      latitude: input.latitude,
      longitude: input.longitude,
      bookingId,
      notes: input.notes,
      status: 'active',
    });

    return {
      alert,
      message: 'Emergency SOS alert recorded with high priority',
      disclaimer:
        'Mock emergency alert logged for development and testing. External emergency services integration is pending.',
    };
  }
}

export const sosService = new SosService();
