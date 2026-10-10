import { z } from 'zod';

import { personNameSchema, uuidSchema } from '../../../common/validation/common.schemas.js';
import { CompatApplicationEvent } from '../domain/compat.constants.js';

const key = z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);

const DMY = /^(\d{2})\/(\d{2})\/(\d{4})$/;

export const compatProfileSchema = z
  .object({
    fullName: personNameSchema,
    pan: z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'must be a 10-character PAN'),
    dob: z
      .string()
      .regex(DMY, 'use DD/MM/YYYY')
      .transform((value) => value.replace(DMY, '$3-$2-$1'))
      .pipe(z.iso.date().refine((value) => value <= new Date().toISOString().slice(0, 10), 'cannot be in the future')),
  })
  .strict();
export type CompatProfileDto = z.output<typeof compatProfileSchema>;

export const compatCategoriesSchema = z.object({ entityType: key }).strict();
export type CompatCategoriesDto = z.output<typeof compatCategoriesSchema>;

export const compatRequirementSchema = z
  .object({
    entityType: key,
    loanCategory: key,
    amount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER / 100),
    tenureYears: z.number().int().positive().max(40),
    location: z.string().trim().min(2).max(120),
    purpose: key,
    purposeNote: z.string().trim().max(500).optional(),
  })
  .strict();
export type CompatRequirementDto = z.output<typeof compatRequirementSchema>;

export const compatPreCheckSchema = z.object({ entityType: key, answers: z.record(z.string().max(60), z.string().max(60)) }).strict();
export type CompatPreCheckDto = z.output<typeof compatPreCheckSchema>;

export const compatConsentSchema = z
  .object({
    version: z.string().max(40),
    submittedAt: z.string().max(40),
    items: z.record(z.string().max(60), z.object({ granted: z.boolean(), at: z.string().max(40) }).strict()),
  })
  .strict();
export type CompatConsentDto = z.output<typeof compatConsentSchema>;

export const compatAnalysisSchema = z.object({ documentIds: z.array(uuidSchema).max(50), consentVersion: z.string().max(40).optional() }).strict();
export type CompatAnalysisDto = z.output<typeof compatAnalysisSchema>;

export const compatAnalysisRefSchema = z.object({ analysisId: uuidSchema }).strict();
export type CompatAnalysisRefDto = z.output<typeof compatAnalysisRefSchema>;

export const compatSubscriptionSchema = z
  .object({ event: z.enum(Object.values(CompatApplicationEvent)), analysisId: uuidSchema.optional(), applicationId: z.string().trim().max(40).optional() })
  .strict();
export type CompatSubscriptionDto = z.output<typeof compatSubscriptionSchema>;

export const compatApplySchema = z.object({ lenderId: uuidSchema }).strict();
export type CompatApplyDto = z.output<typeof compatApplySchema>;

export const submissionRefSchema = z.string().trim().regex(/^SB-\d{2}-\d+$/i);
