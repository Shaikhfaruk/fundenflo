import { z } from 'zod';

const key = z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);
const pastDate = z.iso.date().refine((value) => value <= new Date().toISOString().slice(0, 10), 'cannot be in the future');

export const createBorrowerProfileSchema = z
  .object({ segment: key, subSegment: key.optional(), businessName: z.string().trim().min(2).max(160).optional(), incorporatedOn: pastDate.optional() })
  .strict();
export type CreateBorrowerProfileDto = z.output<typeof createBorrowerProfileSchema>;

export const updateBorrowerProfileSchema = z
  .object({ subSegment: key.nullable().optional(), incorporatedOn: pastDate.nullable().optional(), businessName: z.string().trim().min(2).max(160).optional() })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, 'send at least one field');
export type UpdateBorrowerProfileDto = z.output<typeof updateBorrowerProfileSchema>;
