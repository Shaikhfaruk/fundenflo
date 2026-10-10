import { z } from 'zod';

import { ApplicationChannel, ApplicationStatus } from '../../../common/enums/db.enums.js';
import { pageQuerySchema } from '../../../common/listing/cursor-page.js';
import { consentItemsSchema } from '../../consents/http/consents.dto.js';
import { DocumentStage } from '../../documents/domain/document.constants.js';
import { QuestionnaireStage } from '../../questionnaires/domain/questionnaire.constants.js';
import { APPLICATION_PARTY_RELATIONSHIPS, CO_PARTY_ROLES } from '../domain/application.constants.js';

const key = z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);
const paise = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

export const createApplicationSchema = z.object({ segment: key, subSegment: key.optional(), businessName: z.string().trim().min(2).max(160).optional(), category: key.optional() }).strict();
export type CreateApplicationDto = z.output<typeof createApplicationSchema>;

export const listApplicationsSchema = pageQuerySchema.extend({ status: z.enum(Object.values(ApplicationStatus)).optional() });
export type ListApplicationsDto = z.output<typeof listApplicationsSchema>;

export const requirementSchema = z
  .object({
    category: key.optional(),
    purpose: key.nullable().optional(),
    purposeNote: z.string().trim().min(2).max(500).nullable().optional(),
    amountPaise: paise.optional(),
    tenureMonths: z.number().int().min(1).max(480).optional(),
    cityId: z.uuid().optional(),
    city: z.string().trim().min(2).max(100).optional(),
    pincode: z.string().trim().regex(/^[1-9]\d{5}$/).optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, 'send at least one field');
export type RequirementDto = z.output<typeof requirementSchema>;

const stageSchema = z.enum([QuestionnaireStage.PreCheck, QuestionnaireStage.Profile, QuestionnaireStage.LenderSpecific, QuestionnaireStage.PostSanction]);

export const questionsQuerySchema = z.object({ stage: stageSchema.default(QuestionnaireStage.PreCheck) });
export type QuestionsQuery = z.output<typeof questionsQuerySchema>;

export const answersSchema = z
  .object({ stage: stageSchema.default(QuestionnaireStage.PreCheck), answers: z.array(z.object({ questionKey: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/), value: z.unknown() }).strict()).min(1).max(100) })
  .strict();
export type AnswersDto = z.output<typeof answersSchema>;

export const checklistStageSchema = z.object({ stage: z.enum(Object.values(DocumentStage)).default(DocumentStage.Assessment) });
export type ChecklistStageQuery = z.output<typeof checklistStageSchema>;

export const withdrawSchema = z.object({ reason: z.string().trim().min(3).max(500) }).strict();
export type WithdrawDto = z.output<typeof withdrawSchema>;

export const applicationConsentSchema = z.object({ templateVersionId: z.uuid(), items: consentItemsSchema }).strict();
export type ApplicationConsentDto = z.output<typeof applicationConsentSchema>;

export const addPartySchema = z
  .object({
    role: z.enum(CO_PARTY_ROLES),
    name: z.string().trim().min(2).max(120),
    mobile: z.string().trim().min(6).max(20),
    countryCode: z.string().trim().regex(/^\+?\d{1,4}$/).optional(),
    relationship: z.enum(APPLICATION_PARTY_RELATIONSHIPS).optional(),
  })
  .strict();
export type AddPartyDto = z.output<typeof addPartySchema>;

export const partyConsentConfirmSchema = z.object({ challengeId: z.uuid(), code: z.string().regex(/^\d{6}$/, 'must be 6 digits'), items: consentItemsSchema }).strict();
export type PartyConsentConfirmDto = z.output<typeof partyConsentConfirmSchema>;

export const partnerApplicationSchema = z.object({ borrowerProfileId: z.uuid(), category: key.optional() }).strict();
export type PartnerApplicationDto = z.output<typeof partnerApplicationSchema>;

export const leadStartSchema = z.object({ segment: key.optional(), subSegment: key.optional(), businessName: z.string().trim().min(2).max(160).optional(), category: key.optional() }).strict();
export type LeadStartDto = z.output<typeof leadStartSchema>;

export const opsCasesSchema = listApplicationsSchema.extend({ category: key.optional(), partnerOrganizationId: z.uuid().optional(), channel: z.enum(Object.values(ApplicationChannel)).optional(), q: z.string().trim().min(2).max(40).optional() });
export type OpsCasesDto = z.output<typeof opsCasesSchema>;
