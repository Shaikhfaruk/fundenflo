import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { UserActor } from '../../../common/context/actor.js';
import { ApplicationEventType, ApplicationPartyConsent, ApplicationPartyRole, ApplicationPartyStatus, ConsentChannel, ContactType, SessionContext } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { EventName } from '../../../common/events/event-names.js';
import type { Locale } from '../../../common/i18n/locale.js';
import { normaliseMobile } from '../../../engines/party-matching/normalise.js';
import type { AppAbility } from '../../access/domain/ability.types.js';
import { MeService } from '../../auth/application/me.service.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { ConsentOtpService } from '../../consents/application/consent-otp.service.js';
import type { ConsentItemInput } from '../../consents/application/consent.service.js';
import { JOURNEY_CONSENT_CONTEXT } from '../../consents/domain/consent.constants.js';
import { PartyResolver } from '../../parties/application/party-resolver.service.js';
import { PartyService } from '../../parties/application/party.service.js';
import { ContactSource } from '../../parties/domain/party.constants.js';
import { CO_PARTIES_MAX, CO_PARTY_ROLES } from '../domain/application.constants.js';
import { type ApplicationPartyRow, ApplicationRepository } from '../infrastructure/application.repository.js';
import { ApplicationTimeline } from './application-timeline.service.js';
import { toApplicationPartyView } from './application.views.js';
import { ApplicationService } from './application.service.js';
import { mapInSequence } from '../../../common/utils/in-sequence.js';

export type CoPartyInput = { role: (typeof CO_PARTY_ROLES)[number]; name: string; mobile: string; countryCode?: string; relationship?: string };

export type PartyConsentConfirmation = { challengeId: string; code: string; items: ConsentItemInput[] };

const isCoParty = (role: ApplicationPartyRole) => (CO_PARTY_ROLES as readonly string[]).includes(role);

@Injectable()
export class ApplicationPartyService {
  constructor(
    private readonly applications: ApplicationService,
    private readonly repository: ApplicationRepository,
    private readonly timeline: ApplicationTimeline,
    private readonly resolver: PartyResolver,
    private readonly parties: PartyService,
    private readonly consentOtp: ConsentOtpService,
    private readonly me: MeService,
    private readonly changes: ChangeRecorder,
  ) {}

  async partyIdsByRole(applicationId: string) {
    const rows = await this.repository.parties(applicationId, ApplicationPartyStatus.active);
    return { coApplicants: rows.filter((row) => row.role === ApplicationPartyRole.co_applicant).map((row) => row.partyId), directors: rows.filter((row) => row.role === ApplicationPartyRole.director).map((row) => row.partyId) };
  }

  async coParties(applicationId: string) {
    const rows = await this.repository.parties(applicationId, ApplicationPartyStatus.active);
    return rows.filter((row) => (CO_PARTY_ROLES as readonly string[]).includes(row.role)).map((row) => ({ partyId: row.partyId, role: row.role, name: row.party.displayName }));
  }

  async list(applicationId: string, ability: AppAbility) {
    await this.applications.get(applicationId, ability);
    const rows = await this.repository.parties(applicationId);
    return { items: await mapInSequence(rows, (row) => this.view(row)) };
  }

  @Transactional()
  async add(applicationId: string, input: CoPartyInput, actor: UserActor, ability: AppAbility) {
    const application = await this.applications.lockedForChange(applicationId, ability);
    const mobile = normaliseMobile(input.mobile, input.countryCode);
    if (!mobile) throw new AppError(ErrorCode.MOBILE_INVALID);
    const resolved = await this.resolver.resolvePersonForLead([{ type: ContactType.mobile, value: mobile.e164 }], input.name, ContactSource.ApplicationParty);
    const existing = await this.repository.findParty({ applicationId, partyId: resolved.partyId });
    if (existing && (!isCoParty(existing.role) || existing.status === ApplicationPartyStatus.active)) {
      throw new AppError(ErrorCode.CONFLICT, { details: { reason: 'already_on_application', role: existing.role } });
    }
    if ((await this.repository.countParties(applicationId, [...CO_PARTY_ROLES])) >= CO_PARTIES_MAX) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'role', code: 'too_many_parties', message: `an application can have at most ${CO_PARTIES_MAX} co-applicants, guarantors and directors` }] });
    }
    const row = existing
      ? await this.reactivate(existing.id, input)
      : await this.repository.createParty({ applicationId, partyId: resolved.partyId, role: input.role, relationship: input.relationship ?? null, addedByUserId: actor.userId });
    await this.timeline.record(applicationId, ApplicationEventType.party_added, { data: { applicationPartyId: row.id, role: input.role, outcome: resolved.outcome } });
    await this.changes.record({ action: AuditAction.ApplicationChanged, entityType: AuditEntity.LoanApplication, entityId: applicationId, event: EventName.ApplicationUpdated, metadata: { ref: application.ref, partyAdded: row.id, role: input.role }, payload: { applicationId, partyId: application.partyId } });
    await this.applications.refresh(applicationId);
    return this.view(row);
  }

  @Transactional()
  async remove(applicationId: string, rowId: string, ability: AppAbility) {
    const application = await this.applications.lockedForChange(applicationId, ability);
    const row = await this.coParty(applicationId, rowId);
    if (row.status === ApplicationPartyStatus.removed) throw new AppError(ErrorCode.INVALID_TRANSITION, { details: { from: row.status, event: 'remove', allowed: [] } });
    await this.repository.updateParty(row.id, { status: ApplicationPartyStatus.removed, removedAt: new Date() });
    await this.timeline.record(applicationId, ApplicationEventType.party_removed, { data: { applicationPartyId: row.id, role: row.role } });
    await this.changes.record({ action: AuditAction.ApplicationChanged, entityType: AuditEntity.LoanApplication, entityId: applicationId, event: EventName.ApplicationUpdated, metadata: { ref: application.ref, partyRemoved: row.id }, payload: { applicationId, partyId: application.partyId } });
    await this.applications.refresh(applicationId);
  }

  async sendConsentOtp(applicationId: string, rowId: string, actor: UserActor, ability: AppAbility, locale: Locale) {
    const application = await this.applications.openForChange(applicationId, ability);
    const row = await this.activeCoParty(applicationId, rowId);
    if (row.consentStatus === ApplicationPartyConsent.granted) throw new AppError(ErrorCode.INVALID_TRANSITION, { details: { from: row.consentStatus, event: 'request_consent', allowed: [] } });
    return this.consentOtp.send(row.partyId, { contextKey: JOURNEY_CONSENT_CONTEXT, applicationId, requesterName: await this.requesterName(actor, application.actingParty.displayName), reference: application.ref }, locale);
  }

  @Transactional()
  async confirmConsentOtp(applicationId: string, rowId: string, input: PartyConsentConfirmation, actor: UserActor, ability: AppAbility, locale: Locale) {
    await this.applications.lockedForChange(applicationId, ability);
    const row = await this.activeCoParty(applicationId, rowId);
    const channel = actor.context === SessionContext.partner ? ConsentChannel.partner_assisted : ConsentChannel.app;
    const result = await this.consentOtp.confirm(row.partyId, { ...input, channel, applicationId, capturedByUserId: actor.userId }, locale);
    const consentStatus = result.missingRequired.length === 0 ? ApplicationPartyConsent.granted : ApplicationPartyConsent.declined;
    await this.repository.updateParty(row.id, { consentStatus, consentedAt: new Date() });
    await this.timeline.record(applicationId, ApplicationEventType.consent_recorded, { data: { applicationPartyId: row.id, consentStatus, purposes: input.items.map((item) => item.purpose) } });
    await this.applications.refresh(applicationId);
    const updated = await this.coParty(applicationId, row.id);
    return { party: await this.view(updated), missingRequired: result.missingRequired };
  }

  async sendBorrowerConsent(applicationId: string, actor: UserActor, ability: AppAbility, locale: Locale) {
    const application = await this.applications.openForChange(applicationId, ability);
    return this.consentOtp.send(application.actingPartyId, { contextKey: JOURNEY_CONSENT_CONTEXT, applicationId, requesterName: await this.requesterName(actor, application.actingParty.displayName), reference: application.ref }, locale);
  }

  @Transactional()
  async confirmBorrowerConsent(applicationId: string, input: PartyConsentConfirmation, actor: UserActor, ability: AppAbility, locale: Locale) {
    const application = await this.applications.lockedForChange(applicationId, ability);
    const result = await this.consentOtp.confirm(application.actingPartyId, { ...input, channel: ConsentChannel.partner_assisted, applicationId, capturedByUserId: actor.userId }, locale);
    await this.timeline.record(applicationId, ApplicationEventType.consent_recorded, { data: { party: 'borrower', purposes: input.items.map((item) => item.purpose), missingRequired: result.missingRequired } });
    await this.applications.refresh(applicationId);
    return { missingRequired: result.missingRequired, application: await this.applications.get(applicationId, ability) };
  }

  private async requesterName(actor: UserActor, fallback: string | null) {
    return (await this.parties.summary(await this.me.partyIdOf(actor.userId))).displayName ?? fallback ?? 'A FundenFlo applicant';
  }

  private async reactivate(id: string, input: CoPartyInput) {
    await this.repository.updateParty(id, { status: ApplicationPartyStatus.active, removedAt: null, role: input.role, relationship: input.relationship ?? null, consentStatus: ApplicationPartyConsent.pending, consentedAt: null });
    const row = await this.repository.findParty({ id });
    if (!row) throw new AppError(ErrorCode.NOT_FOUND);
    return row;
  }

  private async coParty(applicationId: string, rowId: string) {
    const row = await this.repository.findParty({ id: rowId, applicationId });
    if (!row || !isCoParty(row.role)) throw new AppError(ErrorCode.NOT_FOUND);
    return row;
  }

  private async activeCoParty(applicationId: string, rowId: string) {
    const row = await this.coParty(applicationId, rowId);
    if (row.status !== ApplicationPartyStatus.active) throw new AppError(ErrorCode.NOT_FOUND);
    return row;
  }

  private async view(row: ApplicationPartyRow) {
    const mobile = (await this.parties.listContacts(row.partyId, false)).find((contact) => contact.type === ContactType.mobile && contact.primary);
    return toApplicationPartyView(row, mobile?.masked ?? null);
  }
}
