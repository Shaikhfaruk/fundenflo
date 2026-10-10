import { z } from 'zod';

import { ActivityOutcome, ActivityType, CatalogStatus, ConsentBasis, FollowUpStatus, OfflineConversionStatus, LeadConsentStatus, LeadFlag, LeadLostReason, LeadSourceKind, LeadStatus, LeadUnqualifiedReason, LeadUrgency } from '../../../common/enums/db.enums.js';
import { SUPPORTED_LOCALES } from '../../../common/i18n/locale.js';
import { MAX_PAGE_SIZE } from '../../../common/constants/listing.constants.js';
import { DAY_MS } from '../../../common/constants/time.constants.js';
import { pageQuerySchema } from '../../../common/listing/cursor-page.js';
import { ACTIVITY_BODY_MAX_LENGTH, ACTIVITY_MAX_DURATION_SECONDS } from '../../activities/domain/activity.constants.js';
import { CONFIG_KEY_PATTERN } from '../../config-publishing/domain/config.constants.js';
import { AssignmentDeclineReason, AssignmentReturnReason, BULK_ROUTE_MAX, OTHER_REASON, PartnerInboxView } from '../domain/lead-routing.constants.js';
import { LEAD_MERGE_MAX, LEAD_NOTE_MAX_LENGTH, LEAD_REPORT_DEFAULT_DAYS, LEAD_REPORT_MAX_DAYS, LEAD_SOURCE_KEY_PATTERN, LEAD_TEXT_MAX_LENGTH } from '../domain/lead.constants.js';
import { FUNNEL_COLUMNS } from '../infrastructure/lead.repository.js';

const key = z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);
const text = z.string().trim().min(1).max(LEAD_TEXT_MAX_LENGTH);
const note = z.string().trim().min(3).max(LEAD_NOTE_MAX_LENGTH);
const paise = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const pincode = z.string().trim().regex(/^[1-9]\d{5}$/);
const language = z.string().regex(/^[a-z]{2,3}$/);
const queryList = <T extends z.ZodType>(item: T) => z.union([item, z.array(item)]).transform((value) => (Array.isArray(value) ? value : [value]) as z.output<T>[]);

const leadCaptureShape = {
  name: z.string().trim().min(1).max(120).optional(),
  mobile: z.string().trim().min(6).max(20).optional(),
  countryCode: z.string().trim().regex(/^\+?\d{1,4}$/).optional(),
  email: z.string().trim().max(254).optional(),
  landline: z.string().trim().min(6).max(20).optional(),
  businessName: z.string().trim().min(2).max(160).optional(),
  segment: key.optional(),
  subSegment: key.optional(),
  category: text.optional(),
  purpose: key.optional(),
  purposeNote: z.string().trim().max(500).optional(),
  amountMinPaise: paise.optional(),
  amountMaxPaise: paise.optional(),
  amountText: z.string().trim().max(60).optional(),
  tenureMonths: z.number().int().min(1).max(480).optional(),
  cityId: z.uuid().optional(),
  city: text.optional(),
  pincode: pincode.optional(),
  urgency: z.enum(Object.values(LeadUrgency)).optional(),
  preferredLanguage: language.optional(),
  preferredContactTime: z.string().trim().max(60).optional(),
  campaign: z.string().trim().max(100).optional(),
  utm: z.record(z.string().regex(/^[a-z][a-z0-9_]{0,39}$/), z.string().max(200)).refine((value) => Object.keys(value).length <= 10, 'at most 10 utm fields').optional(),
  externalRef: z.string().trim().regex(/^[A-Za-z0-9._:/-]{1,100}$/).optional(),
  answers: z.array(z.object({ questionKey: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/), value: z.unknown() }).strict()).max(100).optional(),
  consent: z
    .object({
      templateVersionId: z.uuid().optional(),
      basis: z.enum(Object.values(ConsentBasis)).optional(),
      evidence: z.string().trim().min(5).max(LEAD_NOTE_MAX_LENGTH).optional(),
      locale: z.enum(SUPPORTED_LOCALES).optional(),
      items: z.array(z.object({ purpose: z.string().regex(/^[a-z][a-z0-9_]{1,49}$/), granted: z.boolean(), organizationIds: z.array(z.uuid()).min(1).max(50).optional() }).strict()).min(1).max(20),
    })
    .strict()
    .optional(),
};

export const publicLeadSchema = z.object(leadCaptureShape).strict();
export type PublicLeadDto = z.output<typeof publicLeadSchema>;

export const opsLeadSchema = z
  .object({ ...leadCaptureShape, source: z.string().regex(LEAD_SOURCE_KEY_PATTERN).optional(), flags: z.array(z.enum([LeadFlag.test, LeadFlag.spam])).max(2).optional() })
  .strict();
export type OpsLeadDto = z.output<typeof opsLeadSchema>;

export const leadListSchema = pageQuerySchema.extend({
  status: queryList(z.enum(Object.values(LeadStatus))).optional(),
  source: z.string().regex(LEAD_SOURCE_KEY_PATTERN).optional(),
  consentStatus: z.enum(Object.values(LeadConsentStatus)).optional(),
  flag: z.enum(Object.values(LeadFlag)).optional(),
  segment: key.optional(),
  category: key.optional(),
  cityId: z.uuid().optional(),
  pincode: pincode.optional(),
  q: z.string().trim().min(2).max(120).optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  assigned: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
});
export type LeadListQuery = z.output<typeof leadListSchema>;

export const leadPatchSchema = z
  .object({
    segment: key.nullable().optional(),
    subSegment: key.nullable().optional(),
    category: text.nullable().optional(),
    purpose: key.nullable().optional(),
    purposeNote: z.string().trim().max(500).nullable().optional(),
    amountMinPaise: paise.nullable().optional(),
    amountMaxPaise: paise.nullable().optional(),
    tenureMonths: z.number().int().min(1).max(480).nullable().optional(),
    cityId: z.uuid().nullable().optional(),
    pincode: pincode.nullable().optional(),
    urgency: z.enum(Object.values(LeadUrgency)).nullable().optional(),
    preferredLanguage: language.nullable().optional(),
    preferredContactTime: z.string().trim().max(60).nullable().optional(),
    campaign: z.string().trim().max(100).nullable().optional(),
    flags: z.array(z.enum(Object.values(LeadFlag))).max(Object.values(LeadFlag).length).optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, 'send at least one field');
export type LeadPatchDto = z.output<typeof leadPatchSchema>;

export const leadNoteSchema = z.object({ note: note.optional() }).strict();
export type LeadNoteDto = z.output<typeof leadNoteSchema>;

export const leadHoldSchema = z.object({ note: note.optional(), holdUntil: z.coerce.date().refine((date) => date > new Date(), 'must be in the future').optional() }).strict();
export type LeadHoldDto = z.output<typeof leadHoldSchema>;

export const leadDisqualifySchema = z.object({ reason: z.enum(Object.values(LeadUnqualifiedReason)), note: note.optional() }).strict();
export type LeadDisqualifyDto = z.output<typeof leadDisqualifySchema>;

export const leadLoseSchema = z.object({ reason: z.enum(Object.values(LeadLostReason)), note: note.optional() }).strict();
export type LeadLoseDto = z.output<typeof leadLoseSchema>;

export const leadMergeSchema = z.object({ survivorLeadId: z.uuid(), leadIds: z.array(z.uuid()).min(1).max(LEAD_MERGE_MAX), note }).strict();
export type LeadMergeDto = z.output<typeof leadMergeSchema>;

export const revealContactSchema = z.object({ reason: note }).strict();

export const assignLeadSchema = z.object({ organizationId: z.uuid(), note: note.optional() }).strict();
export type AssignLeadDto = z.output<typeof assignLeadSchema>;

export const revokeAssignmentSchema = z.object({ reason: note }).strict();
export type RevokeAssignmentDto = z.output<typeof revokeAssignmentSchema>;

export const bulkRouteSchema = z.object({ leadIds: z.array(z.uuid()).min(1).max(BULK_ROUTE_MAX) }).strict();
export type BulkRouteDto = z.output<typeof bulkRouteSchema>;

export const bulkAssignSchema = z.object({ leadIds: z.array(z.uuid()).min(1).max(BULK_ROUTE_MAX), organizationId: z.uuid(), note: note.optional() }).strict();
export type BulkAssignDto = z.output<typeof bulkAssignSchema>;

export const simulateRoutingSchema = z.object({ leadId: z.uuid() }).strict();

const otherNeedsNote = (value: { reason: string; note?: string }) => value.reason !== OTHER_REASON || value.note !== undefined;

const OTHER_NEEDS_NOTE = { path: ['note'], message: 'explain the reason when it is other' };

export const declineAssignmentSchema = z.object({ reason: z.enum(Object.values(AssignmentDeclineReason)), note: note.optional() }).strict().refine(otherNeedsNote, OTHER_NEEDS_NOTE);
export type DeclineAssignmentDto = z.output<typeof declineAssignmentSchema>;

export const returnAssignmentSchema = z.object({ reason: z.enum(Object.values(AssignmentReturnReason)), note: note.optional() }).strict().refine(otherNeedsNote, OTHER_NEEDS_NOTE);
export type ReturnAssignmentDto = z.output<typeof returnAssignmentSchema>;

export const subAssignSchema = z.object({ membershipId: z.uuid() }).strict();
export type SubAssignDto = z.output<typeof subAssignSchema>;

export const partnerInboxQuerySchema = pageQuerySchema.extend({ view: z.enum(Object.values(PartnerInboxView)).optional() });
export type PartnerInboxQuery = z.output<typeof partnerInboxQuerySchema>;
export type SimulateRoutingDto = z.output<typeof simulateRoutingSchema>;

export const consentRequestSchema = z.object({ context: z.string().trim().regex(CONFIG_KEY_PATTERN).optional() }).strict();
export type ConsentRequestDto = z.output<typeof consentRequestSchema>;
export type RevealContactDto = z.output<typeof revealContactSchema>;

export const leadSourceSchema = z
  .object({
    key: z.string().trim().regex(LEAD_SOURCE_KEY_PATTERN),
    name: z.string().trim().min(3).max(100),
    kind: z.enum([LeadSourceKind.web_form, LeadSourceKind.partner_referral, LeadSourceKind.webhook, LeadSourceKind.api, LeadSourceKind.import, LeadSourceKind.manual]),
    questionSetStage: z.string().regex(/^[a-z_]{3,40}$/).optional(),
    consentContext: z.string().trim().regex(CONFIG_KEY_PATTERN).optional(),
    defaultLawfulBasis: z.enum(Object.values(ConsentBasis)).optional(),
  })
  .strict();
export type LeadSourceDto = z.output<typeof leadSourceSchema>;

export const leadSourcePatchSchema = z
  .object({
    name: z.string().trim().min(3).max(100).optional(),
    questionSetStage: z.string().regex(/^[a-z_]{3,40}$/).nullable().optional(),
    consentContext: z.string().trim().regex(CONFIG_KEY_PATTERN).nullable().optional(),
    defaultLawfulBasis: z.enum(Object.values(ConsentBasis)).nullable().optional(),
    status: z.enum(Object.values(CatalogStatus)).optional(),
  })
  .strict();
export type LeadSourcePatchDto = z.output<typeof leadSourcePatchSchema>;

export const leadSourceListSchema = z.object({ status: z.enum(Object.values(CatalogStatus)).optional() });
export type LeadSourceListQuery = z.output<typeof leadSourceListSchema>;

export const logActivitySchema = z
  .object({
    type: z.enum(Object.values(ActivityType)),
    outcome: z.enum(Object.values(ActivityOutcome)).optional(),
    body: z.string().trim().min(1).max(ACTIVITY_BODY_MAX_LENGTH).optional(),
    contactId: z.uuid().optional(),
    durationSeconds: z.number().int().min(0).max(ACTIVITY_MAX_DURATION_SECONDS).optional(),
    occurredAt: z.coerce.date().optional(),
  })
  .strict()
  .refine((value) => value.type !== ActivityType.note || value.body !== undefined, { path: ['body'], message: 'a note needs a body' });
export type LogActivityDto = z.output<typeof logActivitySchema>;

export const createFollowUpSchema = z.object({ dueAt: z.coerce.date(), note, assigneeMembershipId: z.uuid().optional() }).strict();
export type CreateFollowUpDto = z.output<typeof createFollowUpSchema>;

export const FollowUpAssignee = { Me: 'me', All: 'all' } as const;

export const followUpListSchema = z.object({
  status: z.enum(Object.values(FollowUpStatus)).default(FollowUpStatus.open),
  dueBefore: z.coerce.date().optional(),
  assignee: z.enum(Object.values(FollowUpAssignee)).default(FollowUpAssignee.Me),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(MAX_PAGE_SIZE),
});
export type FollowUpListDto = z.output<typeof followUpListSchema>;

export const updateFollowUpSchema = z
  .object({ status: z.enum([FollowUpStatus.done, FollowUpStatus.cancelled]).optional(), dueAt: z.coerce.date().optional(), outcomeNote: note.optional() })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'change at least one field');
export type UpdateFollowUpDto = z.output<typeof updateFollowUpSchema>;

const { campaign: _campaign, utm: _utm, externalRef: _externalRef, consent: _consent, ...referralShape } = leadCaptureShape;

export const partnerReferralSchema = z
  .object({
    ...referralShape,
    mobile: z.string().trim().min(6).max(20),
    consent: z
      .object({
        templateVersionId: z.uuid(),
        locale: z.enum(SUPPORTED_LOCALES).optional(),
        items: z.array(z.object({ purpose: z.string().regex(/^[a-z][a-z0-9_]{1,49}$/), granted: z.boolean() }).strict()).min(1).max(20),
      })
      .strict()
      .optional(),
    requestConsent: z.boolean().default(true),
  })
  .strict();
export type PartnerReferralDto = z.output<typeof partnerReferralSchema>;

const { campaign: _patchCampaign, flags: _patchFlags, ...partnerPatchShape } = leadPatchSchema.shape;

export const partnerLeadPatchSchema = z
  .object(partnerPatchShape)
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, 'send at least one field');
export type PartnerLeadPatchDto = z.output<typeof partnerLeadPatchSchema>;

const pastDate = z.iso.date().refine((value) => value <= new Date().toISOString().slice(0, 10), 'cannot be in the future');

export const offlineConversionSchema = z
  .object({
    lenderName: z.string().trim().min(2).max(120),
    lenderOrganizationId: z.uuid().optional(),
    categoryKey: key.optional(),
    sanctionedAmountPaise: paise.positive(),
    disbursedAmountPaise: paise.positive().optional(),
    sanctionedOn: pastDate,
    disbursedOn: pastDate.optional(),
    loanAccountRef: z.string().trim().min(2).max(60).optional(),
    note: note.optional(),
  })
  .strict()
  .refine((value) => !value.disbursedOn || value.disbursedOn >= value.sanctionedOn, { path: ['disbursedOn'], message: 'must be on or after sanctionedOn' })
  .refine((value) => (value.disbursedOn === undefined) === (value.disbursedAmountPaise === undefined), { path: ['disbursedAmountPaise'], message: 'send disbursedOn and disbursedAmountPaise together' });
export type OfflineConversionDto = z.output<typeof offlineConversionSchema>;

export const conversionListSchema = pageQuerySchema.extend({ status: z.enum(Object.values(OfflineConversionStatus)).default(OfflineConversionStatus.reported) });
export type ConversionListDto = z.output<typeof conversionListSchema>;

export const ConversionDecision = { Verify: 'verify', Reject: 'reject' } as const;

export const conversionDecisionSchema = z
  .object({ decision: z.enum(Object.values(ConversionDecision)), note: note.optional() })
  .strict()
  .refine((value) => value.decision !== ConversionDecision.Reject || value.note !== undefined, { path: ['note'], message: 'explain why the conversion is rejected' });
export type ConversionDecisionDto = z.output<typeof conversionDecisionSchema>;

const rangeShape = { from: z.coerce.date().optional(), to: z.coerce.date().optional() };

const withRange = <T extends { from?: Date; to?: Date }>(value: T) => {
  const to = value.to ?? new Date();
  return { ...value, to, from: value.from ?? new Date(to.getTime() - LEAD_REPORT_DEFAULT_DAYS * DAY_MS) };
};

const validRange = (value: { from: Date; to: Date }) => value.from < value.to && value.to.getTime() - value.from.getTime() <= LEAD_REPORT_MAX_DAYS * DAY_MS;

const RANGE_ISSUE = { path: ['from'], message: `from must be before to, at most ${LEAD_REPORT_MAX_DAYS} days apart` };

export const reportRangeSchema = z.object(rangeShape).transform(withRange).refine(validRange, RANGE_ISSUE);
export type ReportRangeDto = z.output<typeof reportRangeSchema>;

export const funnelReportSchema = z
  .object({ ...rangeShape, groupBy: z.enum(Object.keys(FUNNEL_COLUMNS) as [keyof typeof FUNNEL_COLUMNS, ...Array<keyof typeof FUNNEL_COLUMNS>]).default('source') })
  .transform(withRange)
  .refine(validRange, RANGE_ISSUE);
export type FunnelReportDto = z.output<typeof funnelReportSchema>;
