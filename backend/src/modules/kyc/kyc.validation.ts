import { z } from 'zod';

const DOCUMENT_TYPES = ['national_id', 'passport', 'driving_license', 'aadhaar', 'pan', 'voter_id', 'other'] as const;

export const submitKycSchema = z.object({
  document_type: z
    .enum(DOCUMENT_TYPES, {
      errorMap: () => ({
        message: `document_type must be one of: ${DOCUMENT_TYPES.join(', ')}`,
      }),
    })
    .optional(),
  documentType: z.enum(DOCUMENT_TYPES).optional(),
  document_number: z
    .string()
    .trim()
    .min(3, 'Document number must be at least 3 characters')
    .max(100)
    .optional(),
  documentNumber: z.string().trim().min(3).max(100).optional(),
  notes: z.string().trim().max(500).optional(),
}).refine(
  (data) => !!(data.document_type || data.documentType),
  { message: 'document_type is required' }
).refine(
  (data) => !!(data.document_number || data.documentNumber),
  { message: 'document_number is required' }
);

export const adminUpdateKycSchema = z.object({
  status: z.enum(['approved', 'rejected'], {
    required_error: 'Status is required',
    errorMap: () => ({ message: "Status must be 'approved' or 'rejected'" }),
  }),
  rejection_reason: z.string().trim().max(500).optional(),
  rejectionReason: z.string().trim().max(500).optional(),
});

export const kycIdParamSchema = z.object({
  id: z.string().trim().min(1, 'KYC submission ID is required'),
});
