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

export const verifyPanSchema = z
  .object({ pan: z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'must be a 10-character PAN'), name: z.string().trim().min(2).max(120).optional(), dateOfBirth: pastDate.optional() })
  .strict();
export type VerifyPanDto = z.output<typeof verifyPanSchema>;

export const partnerBorrowerSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    mobile: z.string().trim().min(6).max(20),
    countryCode: z.string().trim().regex(/^\+?\d{1,4}$/).optional(),
    segment: key,
    subSegment: key.optional(),
    businessName: z.string().trim().min(2).max(160).optional(),
    incorporatedOn: pastDate.optional(),
  })
  .strict();
export type PartnerBorrowerDto = z.output<typeof partnerBorrowerSchema>;
