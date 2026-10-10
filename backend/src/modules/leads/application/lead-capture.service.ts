import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { DAY_MS } from '../../../common/constants/time.constants.js';
import {
  AnswerChannel,
  type ConsentBasis,
  ConsentChannel,
  ContactType,
  LeadEventType,
  LeadFlag,
  type LeadUrgency,
} from '../../../common/enums/db.enums.js';
import { EventName } from '../../../common/events/event-names.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { DEFAULT_LOCALE, type Locale } from '../../../common/i18n/locale.js';
import { parseAmountText } from '../../../common/money/parse-amount.js';
import { paiseFromNumber } from '../../../common/money/paise.js';
import { normaliseEmail, normaliseLandline, normaliseMobile } from '../../../engines/party-matching/normalise.js';
import { OPEN_LEAD_STATES } from '../../../engines/state-machines/machines/lead.machine.js';
import { CipherPurpose } from '../../../infrastructure/crypto/crypto.constants.js';
import { FieldCipher } from '../../../infrastructure/crypto/field-cipher.service.js';
import { RefGenerator, RefKind } from '../../../infrastructure/database/ref-generator.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { CatalogQueryService } from '../../catalog/application/catalog-query.service.js';
import { PlaceLocator } from '../../catalog/application/place-locator.service.js';
import type { ConfigIssue } from '../../config-publishing/domain/config.types.js';
import { ConsentService, type ConsentItemInput } from '../../consents/application/consent.service.js';
import { PartyResolver, type UnverifiedContact } from '../../parties/application/party-resolver.service.js';
import { PartyService } from '../../parties/application/party.service.js';
import { ContactSource } from '../../parties/domain/party.constants.js';
import { type AnswerInput, QuestionnaireService } from '../../questionnaires/application/questionnaire.service.js';
import { QuestionnaireStage } from '../../questionnaires/domain/questionnaire.constants.js';
import { LEAD_DUPLICATE_WINDOW_DAYS, LEAD_RAW_PAYLOAD_MAX_BYTES } from '../domain/lead.constants.js';
import { LeadRepository } from '../infrastructure/lead.repository.js';
import { LeadConsentPolicy } from './lead-consent.policy.js';
import { LeadTimeline } from './lead-timeline.service.js';
import { scoreFor } from './lead-scoring.js';
import { type LeadSourceView, toLeadDetailView } from './lead.views.js';

export type LeadCaptureInput = {
  name?: string;
  mobile?: string;
  countryCode?: string;
  email?: string;
  landline?: string;
  businessName?: string;
  segment?: string;
  subSegment?: string;
  category?: string;
  purpose?: string;
  purposeNote?: string;
  amountMinPaise?: number;
  amountMaxPaise?: number;
  amountText?: string;
  tenureMonths?: number;
  cityId?: string;
  city?: string;
  pincode?: string;
  urgency?: LeadUrgency;
  preferredLanguage?: string;
  preferredContactTime?: string;
  campaign?: string;
  utm?: Record<string, string>;
  externalRef?: string;
  flags?: LeadFlag[];
  answers?: AnswerInput[];
  consent?: { templateVersionId?: string; basis?: ConsentBasis; evidence?: string; locale?: Locale; items: ConsentItemInput[] };
};

export type LeadCaptureContext = {
  source: LeadSourceView;
  partyId?: string;
  consentChannel: ConsentChannel;
  answerChannel: AnswerChannel;
  capturedByUserId?: string;
  apiClientId?: string;
  importBatchId?: string;
  importRowNumber?: number;
  locale: Locale;
};

type Contacts = { contacts: UnverifiedContact[]; invalid: boolean; hasMobile: boolean; hasEmail: boolean };

type CapturedPerson = { partyId: string; outcome: string; doNotContact: boolean; invalid: boolean; hasMobile: boolean; hasEmail: boolean; hasName: boolean };

@Injectable()
export class LeadCaptureService {
  constructor(
    private readonly leads: LeadRepository,
    private readonly resolver: PartyResolver,
    private readonly parties: PartyService,
    private readonly catalog: CatalogQueryService,
    private readonly locator: PlaceLocator,
    private readonly consents: ConsentService,
    private readonly consentPolicy: LeadConsentPolicy,
    private readonly questionnaires: QuestionnaireService,
    private readonly refs: RefGenerator,
    private readonly cipher: FieldCipher,
    private readonly timeline: LeadTimeline,
    private readonly changes: ChangeRecorder,
  ) {}

  @Transactional()
  async capture(input: LeadCaptureInput, context: LeadCaptureContext) {
    if (input.externalRef) {
      const existing = await this.leads.findByExternalRef(context.source.id, input.externalRef);
      if (existing) return { lead: await this.detail(existing.id), replayed: true };
    }
    const person = await this.person(input, context);
    const rawPayload = JSON.stringify(input);
    if (Buffer.byteLength(rawPayload, 'utf8') > LEAD_RAW_PAYLOAD_MAX_BYTES) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: '', code: 'too_big', message: `lead payload must be at most ${LEAD_RAW_PAYLOAD_MAX_BYTES} bytes` }] });
    }

    const businessPartyId = input.businessName ? await this.businessParty(person.partyId, input.businessName.trim()) : null;
    const requirement = await this.requirement(input);
    const location = await this.locator.locate({ cityId: input.cityId, city: input.city, pincode: input.pincode });
    const amount = this.amount(input);

    const flags = new Set<LeadFlag>(input.flags ?? []);
    if (person.invalid) flags.add(LeadFlag.invalid_number);
    if (person.doNotContact) flags.add(LeadFlag.do_not_contact);
    if (requirement.unmapped) flags.add(LeadFlag.unmapped_category);
    if (location.unmapped) flags.add(LeadFlag.unmapped_location);
    const duplicate = await this.leads.findOpenDuplicate(person.partyId, requirement.categoryKey, new Date(Date.now() - LEAD_DUPLICATE_WINDOW_DAYS * DAY_MS), OPEN_LEAD_STATES);
    if (duplicate) flags.add(LeadFlag.duplicate);

    const lead = await this.leads.create({
      ref: await this.refs.next(RefKind.Lead),
      partyId: person.partyId,
      businessPartyId,
      sourceId: context.source.id,
      apiClientId: context.apiClientId ?? null,
      capturedByUserId: context.capturedByUserId ?? null,
      campaign: input.campaign ?? null,
      utm: input.utm ?? undefined,
      externalRef: input.externalRef ?? null,
      segmentKey: requirement.segmentKey,
      subSegmentKey: requirement.subSegmentKey,
      categoryKey: requirement.categoryKey,
      purposeKey: requirement.purposeKey,
      purposeNote: requirement.purposeNote,
      amountMinPaise: amount.min,
      amountMaxPaise: amount.max,
      amountText: input.amountText ?? null,
      tenureMonths: input.tenureMonths ?? null,
      stateId: location.stateId,
      cityId: location.cityId,
      pincode: location.pincode,
      locationText: location.text,
      urgency: input.urgency ?? null,
      preferredLanguage: input.preferredLanguage ?? null,
      preferredContactTime: input.preferredContactTime ?? null,
      flags: [...flags],
      lawfulBasis: input.consent?.basis ?? context.source.defaultLawfulBasis ?? null,
      consentEvidence: input.consent?.evidence ?? null,
      duplicateOfLeadId: duplicate?.id ?? null,
      importBatchId: context.importBatchId ?? null,
      importRowNumber: context.importRowNumber ?? null,
      rawPayloadEnc: this.cipher.encryptJson(input, CipherPurpose.LeadRawPayload),
    });

    if (input.consent) {
      await this.consents.record(
        person.partyId,
        input.consent.items,
        {
          channel: context.consentChannel,
          basis: input.consent.basis ?? context.source.defaultLawfulBasis ?? undefined,
          templateVersionId: input.consent.templateVersionId,
          evidence: input.consent.evidence,
          locale: input.consent.locale ?? context.locale,
          capturedByUserId: context.capturedByUserId,
          leadId: lead.id,
        },
        input.consent.locale ?? context.locale,
      );
    }
    if (input.answers?.length) {
      await this.questionnaires.submitAnswers(
        person.partyId,
        { stage: QuestionnaireStage.LeadCapture, segment: requirement.segmentKey ?? undefined, subSegment: requirement.subSegmentKey ?? undefined, category: requirement.categoryKey ?? undefined, leadSource: context.source.key },
        input.answers,
        { channel: context.answerChannel, answeredByUserId: context.capturedByUserId, leadId: lead.id },
      );
    }

    const consentStatus = await this.consentPolicy.statusFor(person.partyId);
    const qualityScore = scoreFor({ ...lead, consentStatus }, { hasMobile: person.hasMobile, hasEmail: person.hasEmail, hasName: person.hasName });
    await this.leads.update(lead.id, { consentStatus, qualityScore });
    await this.timeline.record(lead.id, LeadEventType.captured, {
      toStatus: lead.status,
      data: { source: context.source.key, partyOutcome: person.outcome, flags: [...flags], duplicateOfLeadId: duplicate?.id ?? null },
    });
    await this.changes.record({
      action: AuditAction.LeadCaptured,
      entityType: AuditEntity.Lead,
      entityId: lead.id,
      event: EventName.LeadCaptured,
      metadata: { ref: lead.ref, source: context.source.key, partyOutcome: person.outcome, flags: [...flags] },
      payload: { leadId: lead.id, ref: lead.ref, partyId: person.partyId, source: context.source.key, consentStatus, categoryKey: requirement.categoryKey, cityId: location.cityId, pincode: location.pincode },
    });
    return { lead: await this.detail(lead.id), replayed: false };
  }

  async captureDropoff(partyId: string, source: LeadSourceView) {
    if ((await this.leads.countForParty(partyId)) > 0) return null;
    return this.capture({}, { source, partyId, consentChannel: ConsentChannel.app, answerChannel: AnswerChannel.borrower, locale: DEFAULT_LOCALE });
  }

  private async person(input: LeadCaptureInput, context: LeadCaptureContext): Promise<CapturedPerson> {
    if (context.partyId) {
      const summary = await this.parties.summary(context.partyId);
      const contacts = await this.parties.listContacts(context.partyId, false);
      return {
        partyId: context.partyId,
        outcome: 'known',
        doNotContact: contacts.some((contact) => contact.doNotContact),
        invalid: contacts.length > 0 && contacts.every((contact) => contact.invalid),
        hasMobile: contacts.some((contact) => contact.type === ContactType.mobile && !contact.invalid),
        hasEmail: contacts.some((contact) => contact.type === ContactType.email && !contact.invalid),
        hasName: Boolean(summary.displayName),
      };
    }
    const parsed = this.contacts(input);
    const resolved = await this.resolver.resolvePersonForLead(parsed.contacts, input.name?.trim() || null, ContactSource.Lead);
    return {
      partyId: resolved.partyId,
      outcome: resolved.outcome,
      doNotContact: resolved.doNotContact,
      invalid: parsed.invalid || resolved.invalidContact,
      hasMobile: parsed.hasMobile,
      hasEmail: parsed.hasEmail,
      hasName: Boolean(input.name?.trim()),
    };
  }

  private async detail(id: string) {
    const lead = await this.leads.findDetail(id);
    if (!lead) throw new AppError(ErrorCode.NOT_FOUND);
    return toLeadDetailView(lead, await this.parties.listContacts(lead.partyId, false));
  }

  private contacts(input: LeadCaptureInput): Contacts {
    const contacts: UnverifiedContact[] = [];
    let invalid = false;
    if (input.mobile) {
      const mobile = normaliseMobile(input.mobile, input.countryCode);
      if (mobile) contacts.push({ type: ContactType.mobile, value: mobile.e164 });
      else invalid = true;
    }
    if (input.landline) {
      const landline = normaliseLandline(input.landline, input.countryCode);
      if (landline) contacts.push({ type: ContactType.landline, value: landline });
      else invalid = true;
    }
    if (input.email) {
      const email = normaliseEmail(input.email);
      if (email) contacts.push({ type: ContactType.email, value: email });
      else invalid = true;
    }
    if (contacts.length === 0) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'mobile', code: 'contact_required', message: 'a lead needs at least one valid mobile, landline or email' }] });
    }
    return { contacts, invalid, hasMobile: contacts.some((contact) => contact.type === ContactType.mobile), hasEmail: contacts.some((contact) => contact.type === ContactType.email) };
  }

  private async businessParty(personPartyId: string, businessName: string): Promise<string> {
    const existing = await this.leads.findBusinessPartyForPerson(personPartyId, businessName);
    if (existing?.businessPartyId) return existing.businessPartyId;
    return (await this.parties.createBusiness({ displayName: businessName })).id;
  }

  private async requirement(input: LeadCaptureInput) {
    const known = await this.catalog.referenceKeys();
    const issues: ConfigIssue[] = [];
    if (input.segment && !known.segments.has(input.segment)) issues.push({ path: 'segment', code: 'unknown_key', message: `unknown or inactive segment ${input.segment}` });
    if (input.subSegment && !known.subSegments.has(input.subSegment)) issues.push({ path: 'subSegment', code: 'unknown_key', message: `unknown or inactive sub-segment ${input.subSegment}` });
    if (issues.length > 0) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: issues });
    const category = input.category ? await this.catalog.resolveCategory(input.category) : null;
    const purposeKnown = Boolean(category && input.purpose && category.purposeKeys.includes(input.purpose));
    const purposeNote = [input.purposeNote, input.purpose && !purposeKnown ? input.purpose : undefined].filter(Boolean).join(' · ') || null;
    return {
      segmentKey: input.segment ?? null,
      subSegmentKey: input.subSegment ?? null,
      categoryKey: category?.key ?? null,
      purposeKey: purposeKnown ? (input.purpose ?? null) : null,
      purposeNote,
      unmapped: Boolean(input.category && !category),
    };
  }

  private amount(input: LeadCaptureInput) {
    if (input.amountMinPaise !== undefined || input.amountMaxPaise !== undefined) {
      const min = input.amountMinPaise ?? null;
      const max = input.amountMaxPaise ?? null;
      if (min !== null && max !== null && min > max) {
        throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'amountMinPaise', code: 'invalid_range', message: 'amountMinPaise must not exceed amountMaxPaise' }] });
      }
      return { min: min === null ? null : paiseFromNumber(min), max: max === null ? null : paiseFromNumber(max) };
    }
    const parsed = input.amountText ? parseAmountText(input.amountText) : null;
    return {
      min: parsed?.minPaise === null || parsed?.minPaise === undefined ? null : paiseFromNumber(parsed.minPaise),
      max: parsed?.maxPaise === null || parsed?.maxPaise === undefined ? null : paiseFromNumber(parsed.maxPaise),
    };
  }
}
