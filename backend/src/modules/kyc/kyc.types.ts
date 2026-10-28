/**
 * Domain representation of a KYC submission.
 */
export interface KycSubmission {
  id: string;
  userId: string;
  documentType: 'national_id' | 'passport' | 'driving_license' | 'aadhaar' | 'pan' | 'voter_id' | 'other';
  documentNumber: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubmitKycInput {
  document_type: string;
  documentType?: string;
  document_number: string;
  documentNumber?: string;
  notes?: string;
}

export interface AdminUpdateKycInput {
  status: 'approved' | 'rejected';
  rejection_reason?: string;
  rejectionReason?: string;
}
