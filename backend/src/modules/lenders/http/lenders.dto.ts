import { z } from 'zod';

import { FactProvenance, LenderAgreementStatus, LenderContactRole, LenderKind, LenderStatus } from '../../../common/enums/db.enums.js';
import { pageQuerySchema } from '../../../common/listing/cursor-page.js';
import { LENDER_KEY_PATTERN, LENDER_SIMULATION_PROFILES_MAX } from '../domain/lender.constants.js';

const isoDay = z.iso.date();
const text = (max: number) => z.string().trim().min(2).max(max);
const key = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);

export const createLenderSchema = z
  .object({
    key: z.string().regex(LENDER_KEY_PATTERN, 'use 2-40 lowercase letters, digits or underscores'),
    name: text(160),
    kind: z.enum(Object.values(LenderKind)),
    rbiRegistrationNo: text(60).optional(),
    website: z.url({ protocol: /^https$/ }).optional(),
    responseSlaHours: z.number().int().min(1).max(720).optional(),
    notes: z.string().trim().max(2_000).optional(),
  })
  .strict();
export type CreateLenderDto = z.output<typeof createLenderSchema>;

export const updateLenderSchema = z
  .object({
    rbiRegistrationNo: text(60).nullable().optional(),
    website: z.url({ protocol: /^https$/ }).nullable().optional(),
    responseSlaHours: z.number().int().min(1).max(720).nullable().optional(),
    notes: z.string().trim().max(2_000).nullable().optional(),
    status: z.enum(Object.values(LenderStatus)).optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, 'send at least one field');
export type UpdateLenderDto = z.output<typeof updateLenderSchema>;

export const listLendersSchema = pageQuerySchema.extend({ status: z.enum(Object.values(LenderStatus)).optional() });
export type ListLendersDto = z.output<typeof listLendersSchema>;

export const createAgreementSchema = z
  .object({ reference: text(80), validFrom: isoDay, validTo: isoDay.optional(), commissionNote: z.string().trim().max(2_000).optional(), commissionSchemeKey: z.string().regex(/^[a-z][a-z0-9_.]{1,79}$/).optional(), documentId: z.uuid().optional() })
  .strict()
  .refine((input) => !input.validTo || input.validTo >= input.validFrom, { path: ['validTo'], message: 'must be on or after validFrom' });
export type CreateAgreementDto = z.output<typeof createAgreementSchema>;

export const updateAgreementSchema = z
  .object({
    status: z.enum(Object.values(LenderAgreementStatus)).optional(),
    validTo: isoDay.nullable().optional(),
    commissionNote: z.string().trim().max(2_000).nullable().optional(),
    commissionSchemeKey: z.string().regex(/^[a-z][a-z0-9_.]{1,79}$/).nullable().optional(),
    documentId: z.uuid().nullable().optional(),
    terminationReason: text(500).optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, 'send at least one field');
export type UpdateAgreementDto = z.output<typeof updateAgreementSchema>;

export const createContactSchema = z
  .object({ name: text(120), designation: text(120).optional(), role: z.enum(Object.values(LenderContactRole)), email: z.string().trim().max(254).optional(), mobile: z.string().trim().min(6).max(20).optional(), countryCode: z.string().trim().regex(/^\+?\d{1,4}$/).optional(), escalationLevel: z.number().int().min(1).max(3).optional() })
  .strict();
export type CreateContactDto = z.output<typeof createContactSchema>;

export const updateContactSchema = z
  .object({ designation: text(120).nullable().optional(), role: z.enum(Object.values(LenderContactRole)).optional(), escalationLevel: z.number().int().min(1).max(3).optional(), active: z.boolean().optional() })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, 'send at least one field');
export type UpdateContactDto = z.output<typeof updateContactSchema>;

const simulationFact = z.object({ attribute: z.string().min(3).max(100), value: z.unknown(), provenance: z.enum(Object.values(FactProvenance)).optional() }).strict();

export const simulateSchema = z
  .object({
    profiles: z
      .array(
        z
          .object({
            label: text(80),
            partyId: z.uuid().optional(),
            request: z
              .object({ segment: key, subSegment: key.optional(), category: key.optional(), amountPaise: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(), tenureMonths: z.number().int().min(1).max(480).optional(), pincode: z.string().regex(/^[1-9]\d{5}$/).optional(), cityId: z.uuid().optional() })
              .strict(),
            facts: z.array(simulationFact).max(100).optional(),
            directors: z.array(z.array(simulationFact).max(100)).max(10).optional(),
            coApplicants: z.array(z.array(simulationFact).max(100)).max(10).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(LENDER_SIMULATION_PROFILES_MAX),
  })
  .strict();
export type SimulateDto = z.output<typeof simulateSchema>;

export const proposeChangeSchema = z.object({ content: z.unknown(), reason: text(1_000) }).strict();
export type ProposeChangeDto = z.output<typeof proposeChangeSchema>;
