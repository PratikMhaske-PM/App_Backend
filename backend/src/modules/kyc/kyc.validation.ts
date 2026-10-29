import { z } from 'zod';

export const submitKycSchema = z
  .object({
    document_type: z.enum(['id_card', 'passport', 'driving_license']).optional(),
    documentType: z.enum(['id_card', 'passport', 'driving_license']).optional(),
    document_number: z.string().trim().min(3).max(50).optional(),
    documentNumber: z.string().trim().min(3).max(50).optional(),
    full_name: z.string().trim().min(2).max(100).optional(),
    fullName: z.string().trim().min(2).max(100).optional(),
    document_url: z.string().trim().url('Invalid document URL').optional(),
    documentUrl: z.string().trim().url('Invalid document URL').optional(),
    expiry_date: z.string().trim().optional(),
    expiryDate: z.string().trim().optional(),
  })
  .strict()
  .refine((data) => !!(data.document_type || data.documentType), {
    message: 'document_type is required (id_card, passport, or driving_license)',
  })
  .refine((data) => !!(data.document_number || data.documentNumber), {
    message: 'document_number is required',
  })
  .refine((data) => !!(data.full_name || data.fullName), {
    message: 'full_name is required',
  });

export const reviewKycSchema = z
  .object({
    status: z.enum(['approved', 'rejected'], {
      required_error: "Status is required and must be 'approved' or 'rejected'",
    }),
    rejection_reason: z.string().trim().max(500).optional(),
    rejectionReason: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.status === 'rejected') {
        return !!(data.rejection_reason || data.rejectionReason);
      }
      return true;
    },
    {
      message: "rejection_reason is required when status is 'rejected'",
    }
  );

export const kycIdParamSchema = z.object({
  id: z.string().trim().min(1, 'KYC ID is required'),
});
