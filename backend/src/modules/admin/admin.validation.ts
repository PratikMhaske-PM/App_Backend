import { z } from 'zod';

export const verifyWorkerSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected'], {
    required_error: 'Verification status is required',
    invalid_type_error: "Status must be 'pending', 'approved', or 'rejected'",
  }),
});

export const adminWorkerIdParamSchema = z.object({
  id: z.string().trim().min(1, 'Worker ID is required'),
});
