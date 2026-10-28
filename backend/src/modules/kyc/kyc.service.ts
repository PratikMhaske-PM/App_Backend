import { db } from '../../config/database';
import { IDatabase } from '../../database/sqlite';
import { AppError } from '../../utils/AppError';
import { AdminUpdateKycInput, KycSubmission, SubmitKycInput } from './kyc.types';

interface KycDbRow {
  id: string;
  user_id: string;
  document_type: string;
  document_number: string;
  notes: string | null;
  status: string;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: KycDbRow): KycSubmission {
  return {
    id: row.id,
    userId: row.user_id,
    documentType: row.document_type as KycSubmission['documentType'],
    documentNumber: row.document_number,
    notes: row.notes ?? undefined,
    status: row.status as KycSubmission['status'],
    rejectionReason: row.rejection_reason ?? undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class KycService {
  constructor(private readonly database: IDatabase = db) {}

  /**
   * Submit a KYC document. Workers may only have one active submission at a time.
   * If a previous rejected submission exists, a new one can be submitted.
   */
  async submitKyc(userId: string, input: SubmitKycInput): Promise<KycSubmission> {
    const documentType = (input.document_type ?? input.documentType) as string;
    const documentNumber = (input.document_number ?? input.documentNumber) as string;

    // Check for existing pending submission
    const pending = this.database.queryOne<KycDbRow>(
      "SELECT id FROM kyc_submissions WHERE user_id = ? AND status = 'pending'",
      [userId]
    );
    if (pending) {
      throw AppError.badRequest(
        'You already have a pending KYC submission. Please wait for the current one to be reviewed.'
      );
    }

    const id = `kyc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    this.database.run(
      'INSERT INTO kyc_submissions (id, user_id, document_type, document_number, notes, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, userId, documentType, documentNumber, input.notes ?? null, 'pending', now, now]
    );

    // Create a notification for the submitter
    this._createNotification(
      userId,
      'kyc_submitted',
      'KYC Submitted',
      'Your KYC document has been submitted and is under review.',
      id
    );

    const created = this.database.queryOne<KycDbRow>(
      'SELECT id, user_id, document_type, document_number, notes, status, rejection_reason, reviewed_by, reviewed_at, created_at, updated_at FROM kyc_submissions WHERE id = ?',
      [id]
    );
    if (!created) throw AppError.internal('Failed to retrieve KYC submission');
    return mapRow(created);
  }

  /**
   * Get KYC status for the authenticated worker.
   * Returns the most recent submission.
   */
  async getKycStatus(userId: string): Promise<KycSubmission | null> {
    const row = this.database.queryOne<KycDbRow>(
      'SELECT id, user_id, document_type, document_number, notes, status, rejection_reason, reviewed_by, reviewed_at, created_at, updated_at FROM kyc_submissions WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    return row ? mapRow(row) : null;
  }

  /**
   * Admin reviews a KYC submission — approve or reject.
   * Creates a notification for the worker upon decision.
   */
  async adminUpdateKyc(
    kycId: string,
    adminUserId: string,
    input: AdminUpdateKycInput
  ): Promise<KycSubmission> {
    const existing = this.database.queryOne<KycDbRow>(
      'SELECT id, user_id, document_type, document_number, notes, status, rejection_reason, reviewed_by, reviewed_at, created_at, updated_at FROM kyc_submissions WHERE id = ?',
      [kycId]
    );
    if (!existing) throw AppError.notFound('KYC submission not found');

    const rejectionReason = (input.rejection_reason ?? input.rejectionReason) ?? null;

    if (input.status === 'rejected' && !rejectionReason) {
      throw AppError.badRequest('A rejection reason must be provided when rejecting a KYC submission');
    }

    const now = new Date().toISOString();
    this.database.run(
      'UPDATE kyc_submissions SET status = ?, rejection_reason = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?',
      [input.status, rejectionReason, adminUserId, now, now, kycId]
    );

    // Notify the worker of the decision
    const title = input.status === 'approved' ? 'KYC Approved' : 'KYC Rejected';
    const body =
      input.status === 'approved'
        ? 'Your KYC document has been approved. You can now accept bookings.'
        : `Your KYC submission was rejected. Reason: ${rejectionReason}`;
    this._createNotification(existing.user_id, `kyc_${input.status}`, title, body, kycId);

    const updated = this.database.queryOne<KycDbRow>(
      'SELECT id, user_id, document_type, document_number, notes, status, rejection_reason, reviewed_by, reviewed_at, created_at, updated_at FROM kyc_submissions WHERE id = ?',
      [kycId]
    );
    if (!updated) throw AppError.internal('Failed to retrieve updated KYC submission');
    return mapRow(updated);
  }

  private _createNotification(
    userId: string,
    type: string,
    title: string,
    body: string,
    relatedId?: string
  ): void {
    try {
      const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date().toISOString();
      this.database.run(
        'INSERT INTO notifications (id, user_id, type, title, body, is_read, related_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [notifId, userId, type, title, body, 0, relatedId ?? null, now, now]
      );
    } catch {
      // Notifications are best-effort; do not fail the primary operation
    }
  }
}

export const kycService = new KycService();
