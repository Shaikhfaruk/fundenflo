import { z } from 'zod';

import { MembershipStatus, PartnerKind, PartnerLevel, PartnerVerificationStatus, VerificationDecision } from '../../../common/enums/db.enums.js';
import { pageQuerySchema } from '../../../common/listing/cursor-page.js';
import {
  FIRM_NAME_MAX_LENGTH,
  LANGUAGE_CODE_PATTERN,
  MAX_LANGUAGES,
  MAX_OPEN_LEADS_LIMIT,
  MAX_SERVICE_AREAS,
  PARTNER_DECISION_NOTE_MAX_LENGTH,
  REGISTRATION_NUMBER_PATTERN,
  WORKING_TIME_PATTERN,
} from '../domain/partner.constants.js';

const keyList = z.array(z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/)).max(50);

const capabilitiesShape = {
  segments: keyList.optional(),
  categories: keyList.optional(),
  languages: z.array(z.string().regex(LANGUAGE_CODE_PATTERN)).max(MAX_LANGUAGES).optional(),
};

export const serviceAreaSchema = z.union([
  z.object({ stateGstCode: z.string().regex(/^\d{2}$/) }).strict(),
  z.object({ cityId: z.uuid() }).strict(),
  z.object({ pincode: z.string().regex(/^[1-9]\d{5}$/) }).strict(),
]);

const serviceAreasSchema = z.array(serviceAreaSchema).max(MAX_SERVICE_AREAS);

const noteSchema = z.string().trim().min(3).max(PARTNER_DECISION_NOTE_MAX_LENGTH);

export const signupSchema = z
  .object({
    kind: z.enum(Object.values(PartnerKind)),
    firmName: z.string().trim().min(2).max(FIRM_NAME_MAX_LENGTH),
    membershipNumber: z.string().trim().regex(REGISTRATION_NUMBER_PATTERN).optional(),
    firmRegistrationNumber: z.string().trim().regex(REGISTRATION_NUMBER_PATTERN).optional(),
    serviceAreas: serviceAreasSchema.optional(),
    ...capabilitiesShape,
  })
  .strict();
export type SignupDto = z.output<typeof signupSchema>;

export const capacitySchema = z
  .object({
    maxOpenLeads: z.number().int().min(0).max(MAX_OPEN_LEADS_LIMIT).nullable().optional(),
    paused: z.boolean().optional(),
    workingDays: z.array(z.number().int().min(1).max(7)).max(7).optional(),
    workingHours: z
      .object({ start: z.string().regex(WORKING_TIME_PATTERN), end: z.string().regex(WORKING_TIME_PATTERN) })
      .strict()
      .refine((hours) => hours.start < hours.end, { message: 'start must be before end', path: ['end'] })
      .nullable()
      .optional(),
    ...capabilitiesShape,
  })
  .strict();
export type CapacityDto = z.output<typeof capacitySchema>;

export const serviceAreasBodySchema = z.object({ areas: serviceAreasSchema }).strict();
export type ServiceAreasDto = z.output<typeof serviceAreasBodySchema>;

export const inviteMemberSchema = z.object({ mobile: z.string().trim().min(6).max(20), countryCode: z.string().trim().regex(/^\+?\d{1,4}$/).optional() }).strict();
export type InviteMemberDto = z.output<typeof inviteMemberSchema>;

export const updateMemberSchema = z.object({ status: z.enum([MembershipStatus.active, MembershipStatus.suspended, MembershipStatus.revoked]) }).strict();
export type UpdateMemberDto = z.output<typeof updateMemberSchema>;

export const listPartnersSchema = pageQuerySchema.extend({
  verificationStatus: z.enum(Object.values(PartnerVerificationStatus)).optional(),
  kind: z.enum(Object.values(PartnerKind)).optional(),
  level: z.enum(Object.values(PartnerLevel)).optional(),
  q: z.string().trim().min(2).max(FIRM_NAME_MAX_LENGTH).optional(),
});
export type ListPartnersQuery = z.output<typeof listPartnersSchema>;

export const verifyPartnerSchema = z.object({ decision: z.enum(Object.values(VerificationDecision)), note: noteSchema }).strict();
export type VerifyPartnerDto = z.output<typeof verifyPartnerSchema>;

export const partnerLevelSchema = z.object({ level: z.enum(Object.values(PartnerLevel)), note: noteSchema }).strict();
export type PartnerLevelDto = z.output<typeof partnerLevelSchema>;

export const partnerNoteSchema = z.object({ note: noteSchema }).strict();
export type PartnerNoteDto = z.output<typeof partnerNoteSchema>;
