export interface SubmitKycInput {
  document_type?: 'id_card' | 'passport' | 'driving_license';
  documentType?: 'id_card' | 'passport' | 'driving_license';
  document_number?: string;
  documentNumber?: string;
  full_name?: string;
  fullName?: string;
  document_url?: string;
  documentUrl?: string;
  expiry_date?: string;
  expiryDate?: string;
}

export interface ReviewKycInput {
  status: 'approved' | 'rejected';
  rejection_reason?: string;
  rejectionReason?: string;
}

export interface WorkerKycStatusResponse {
  id?: string;
  workerId: string;
  status: string;
  documentType?: string;
  submittedAt?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}
