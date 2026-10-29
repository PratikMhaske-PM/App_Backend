import { defaultKycRepository, IKycRepository } from '../../repositories/kyc.repo';
import { defaultWorkerRepository, IWorkerRepository } from '../../repositories/worker.repo';
import { KycApplication } from '../../types/common.types';
import { AppError } from '../../utils/AppError';
import { ReviewKycInput, SubmitKycInput, WorkerKycStatusResponse } from './kyc.types';

export class KycService {
  constructor(
    private readonly kycRepo: IKycRepository = defaultKycRepository,
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
   * API 26: POST /kyc/submit
   * Role: Worker
   * Submit worker KYC information for verification.
   * Enforces initial 'pending' status and avoids duplicate pending submissions.
   */
  async submitKyc(userId: string, input: SubmitKycInput): Promise<KycApplication> {
    const worker = await this.getWorkerByUserId(userId);

    const existing = await this.kycRepo.findByWorkerId(worker.id);
    if (existing && existing.status === 'pending') {
      throw AppError.badRequest('You already have a KYC verification application pending review');
    }

    const documentType = (input.document_type || input.documentType) as string;
    const documentNumber = (input.document_number || input.documentNumber) as string;
    const fullName = (input.full_name || input.fullName) as string;
    const documentUrl = input.document_url || input.documentUrl;
    const expiryDate = input.expiry_date || input.expiryDate;

    return this.kycRepo.create({
      workerId: worker.id,
      documentType,
      documentNumber,
      fullName,
      documentUrl,
      expiryDate,
      status: 'pending',
    });
  }

  /**
   * API 27: GET /kyc/status
   * Role: Worker
   * Retrieve the authenticated worker's KYC status.
   */
  async getKycStatus(userId: string): Promise<WorkerKycStatusResponse> {
    const worker = await this.getWorkerByUserId(userId);

    const existing = await this.kycRepo.findByWorkerId(worker.id);
    if (!existing) {
      return {
        workerId: worker.id,
        status: 'not_submitted',
      };
    }

    return {
      id: existing.id,
      workerId: existing.workerId,
      status: existing.status,
      documentType: existing.documentType,
      submittedAt: existing.submittedAt,
      reviewedAt: existing.reviewedAt,
      rejectionReason: existing.rejectionReason,
    };
  }

  /**
   * API 28: PATCH /admin/kyc/:id
   * Role: Admin
   * Approve or reject a worker KYC application.
   * Prevents self-approval and synchronizes worker profile verification status.
   */
  async reviewKyc(
    kycId: string,
    adminUserId: string,
    input: ReviewKycInput
  ): Promise<KycApplication> {
    const application = await this.kycRepo.findById(kycId);
    if (!application) {
      throw AppError.notFound(`KYC application with ID '${kycId}' not found`);
    }

    // Prevent unauthorized self-approval
    const worker = await this.workerRepo.findById(application.workerId);
    if (worker && worker.userId === adminUserId) {
      throw AppError.forbidden('Administrators cannot verify or approve their own worker KYC application');
    }

    const reviewedAt = new Date().toISOString();
    const rejectionReason = input.rejection_reason || input.rejectionReason;

    const updated = await this.kycRepo.update(kycId, {
      status: input.status,
      reviewedAt,
      reviewedBy: adminUserId,
      rejectionReason: input.status === 'rejected' ? rejectionReason : undefined,
    });

    // Synchronize worker profile status if worker exists
    if (worker) {
      await this.workerRepo.updateProfile(worker.id, {
        verificationStatus: input.status as 'approved' | 'rejected',
      });
    }

    return updated;
  }
}

export const kycService = new KycService();
