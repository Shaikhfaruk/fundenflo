import { accessibleBy } from '@casl/prisma/runtime';
import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { UserActor } from '../../../common/context/actor.js';
import { type LenderContactRole, type LenderKind, LenderAgreementStatus, type LenderStatus, OrganizationType } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { transitionOrThrow } from '../../../common/errors/transition.js';
import { EventName } from '../../../common/events/event-names.js';
import { assertVersion } from '../../../common/http/versioning.js';
import { type PageQuery, pageWindow, toPage } from '../../../common/listing/cursor-page.js';
import { maskEmail, maskMobile } from '../../../engines/party-matching/mask.js';
import { normaliseEmail, normaliseMobile } from '../../../engines/party-matching/normalise.js';
import { AGREEMENT_EVENT_FOR_STATUS, agreementMachine, LENDER_EVENT_FOR_STATUS, lenderMachine } from '../../../engines/state-machines/machines/lender.machine.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { runThenInvalidate } from '../../../infrastructure/cache/run-then-invalidate.js';
import { CipherPurpose } from '../../../infrastructure/crypto/crypto.constants.js';
import { FieldCipher } from '../../../infrastructure/crypto/field-cipher.service.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { OrganizationService } from '../../access/application/organization.service.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { DocumentService } from '../../documents/application/document.service.js';
import { LENDER_CACHE_TAG, LENDER_CONTACTS_MAX } from '../domain/lender.constants.js';
import { type LenderRow, LenderRepository } from '../infrastructure/lender.repository.js';
import { toAgreementView, toContactView, toLenderView } from './lender.views.js';

export type LenderInput = { key: string; name: string; kind: LenderKind; rbiRegistrationNo?: string; website?: string; responseSlaHours?: number; notes?: string };

export type LenderPatch = { rbiRegistrationNo?: string | null; website?: string | null; responseSlaHours?: number | null; notes?: string | null; status?: LenderStatus };

export type AgreementInput = { reference: string; validFrom: string; validTo?: string; commissionNote?: string; commissionSchemeKey?: string; documentId?: string };

export type AgreementPatch = { status?: LenderAgreementStatus; validTo?: string | null; commissionNote?: string | null; commissionSchemeKey?: string | null; documentId?: string | null; terminationReason?: string };

export type ContactInput = { name: string; designation?: string; role: LenderContactRole; email?: string; mobile?: string; countryCode?: string; escalationLevel?: number };

export type ContactPatch = { designation?: string | null; role?: LenderContactRole; escalationLevel?: number; active?: boolean };

const toDay = (value: string) => new Date(`${value}T00:00:00.000Z`);

@Injectable()
export class LenderService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTx>,
    private readonly lenders: LenderRepository,
    private readonly organizations: OrganizationService,
    private readonly documents: DocumentService,
    private readonly cipher: FieldCipher,
    private readonly cache: CacheService,
    private readonly changes: ChangeRecorder,
  ) {}

  create(input: LenderInput, actor: UserActor) {
    return runThenInvalidate(this.txHost, this.cache, [LENDER_CACHE_TAG], async () => {
      if (await this.lenders.findOne({ key: input.key })) throw new AppError(ErrorCode.CONFLICT, { details: { key: input.key } });
      const organization = await this.organizations.registerActive({ type: OrganizationType.lender, name: input.name, createdByUserId: actor.userId });
      const lender = await this.lenders.create({
        organizationId: organization.id,
        key: input.key,
        kind: input.kind,
        rbiRegistrationNo: input.rbiRegistrationNo ?? null,
        website: input.website ?? null,
        responseSlaHours: input.responseSlaHours ?? null,
        notes: input.notes ?? null,
        createdByUserId: actor.userId,
      });
      await this.record(lender.id, AuditAction.LenderCreated, { key: lender.key, kind: lender.kind });
      return toLenderView(lender);
    });
  }

  async list(ability: AppAbility, query: PageQuery & { status?: LenderStatus }) {
    const window = pageWindow(query);
    const rows = await this.lenders.list({ AND: [accessibleBy(ability, AppAction.Read).ofType('Lender'), { id: window.idFilter, status: query.status }] }, window.take);
    return toPage(rows, query.limit, toLenderView);
  }

  async get(id: string, ability: AppAbility) {
    return toLenderView(await this.visible(id, ability, AppAction.Read));
  }

  async summaries(ids: string[]) {
    return new Map((await this.lenders.list({ id: { in: ids } }, ids.length)).map((lender) => [lender.id, { id: lender.id, key: lender.key, name: lender.organization.name, organizationId: lender.organizationId }]));
  }

  async forOrganization(organizationId: string) {
    const lender = await this.lenders.findOne({ organizationId });
    if (!lender) throw new AppError(ErrorCode.NOT_FOUND);
    return lender;
  }

  async visible(id: string, ability: AppAbility, action: AppAction): Promise<LenderRow> {
    const lender = await this.lenders.findOne({ AND: [accessibleBy(ability, action).ofType('Lender'), { id }] });
    if (!lender) throw new AppError(ErrorCode.NOT_FOUND);
    return lender;
  }

  update(id: string, patch: LenderPatch, expectedVersion: number | undefined, ability: AppAbility) {
    return runThenInvalidate(this.txHost, this.cache, [LENDER_CACHE_TAG], async () => {
      const lender = await this.visible(id, ability, AppAction.Update);
      assertVersion(expectedVersion, lender.version);
      const event = patch.status && patch.status !== lender.status ? LENDER_EVENT_FOR_STATUS[patch.status] : undefined;
      if (patch.status && patch.status !== lender.status && !event) throw new AppError(ErrorCode.INVALID_TRANSITION, { details: { from: lender.status, to: patch.status, allowed: lenderMachine.events(lender.status) } });
      const status = event ? transitionOrThrow(lenderMachine, lender.status, event) : lender.status;
      const moved = await this.lenders.updateVersioned(id, lender.version, { rbiRegistrationNo: patch.rbiRegistrationNo, website: patch.website, responseSlaHours: patch.responseSlaHours, notes: patch.notes, status });
      if (moved.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT, { details: { currentVersion: lender.version + 1 } });
      await this.record(id, AuditAction.LenderChanged, { fields: Object.keys(patch), from: lender.status, to: status });
      return this.get(id, ability);
    });
  }

  async agreements(lenderId: string, ability: AppAbility) {
    await this.visible(lenderId, ability, AppAction.Read);
    return { items: (await this.lenders.agreements(lenderId)).map((agreement) => toAgreementView(agreement)) };
  }

  createAgreement(lenderId: string, input: AgreementInput, actor: UserActor, ability: AppAbility) {
    return runThenInvalidate(this.txHost, this.cache, [LENDER_CACHE_TAG], async () => {
      const lender = await this.visible(lenderId, ability, AppAction.Update);
      if (input.documentId) await this.assertLenderDocument(lender, input.documentId, ability);
      const agreement = await this.lenders.createAgreement({
        lenderId,
        reference: input.reference,
        validFrom: toDay(input.validFrom),
        validTo: input.validTo ? toDay(input.validTo) : null,
        commissionNote: input.commissionNote ?? null,
        commissionSchemeKey: input.commissionSchemeKey ?? null,
        documentId: input.documentId ?? null,
        createdByUserId: actor.userId,
      });
      await this.record(lenderId, AuditAction.LenderAgreementCreated, { agreementId: agreement.id, reference: agreement.reference });
      return toAgreementView(agreement);
    });
  }

  updateAgreement(lenderId: string, agreementId: string, patch: AgreementPatch, expectedVersion: number | undefined, ability: AppAbility) {
    return runThenInvalidate(this.txHost, this.cache, [LENDER_CACHE_TAG], async () => {
      const lender = await this.visible(lenderId, ability, AppAction.Update);
      const agreement = await this.lenders.findAgreement(lenderId, agreementId);
      if (!agreement) throw new AppError(ErrorCode.NOT_FOUND);
      assertVersion(expectedVersion, agreement.version);
      const changing = patch.status !== undefined && patch.status !== agreement.status;
      const event = changing && patch.status ? AGREEMENT_EVENT_FOR_STATUS[patch.status] : undefined;
      if (changing && !event) throw new AppError(ErrorCode.INVALID_TRANSITION, { details: { from: agreement.status, to: patch.status, allowed: agreementMachine.events(agreement.status) } });
      const status = event ? transitionOrThrow(agreementMachine, agreement.status, event) : agreement.status;
      if (status === LenderAgreementStatus.terminated && changing && !patch.terminationReason) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'terminationReason', code: 'required', message: 'say why the agreement ends' }] });
      if (patch.documentId) await this.assertLenderDocument(lender, patch.documentId, ability);
      const validTo = patch.validTo === undefined ? agreement.validTo : patch.validTo === null ? null : toDay(patch.validTo);
      if (validTo && validTo < agreement.validFrom) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'validTo', code: 'before_start', message: 'must be on or after validFrom' }] });
      const now = new Date();
      const moved = await this.lenders.updateAgreementVersioned(agreementId, agreement.version, {
        status,
        validTo,
        commissionNote: patch.commissionNote,
        commissionSchemeKey: patch.commissionSchemeKey,
        documentId: patch.documentId,
        ...(changing && status === LenderAgreementStatus.active ? { activatedAt: now } : {}),
        ...(changing && status === LenderAgreementStatus.terminated ? { terminatedAt: now, terminationReason: patch.terminationReason } : {}),
      });
      if (moved.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT, { details: { currentVersion: agreement.version + 1 } });
      await this.record(lenderId, AuditAction.LenderAgreementChanged, { agreementId, fields: Object.keys(patch), from: agreement.status, to: status });
      const updated = await this.lenders.findAgreement(lenderId, agreementId);
      if (!updated) throw new AppError(ErrorCode.NOT_FOUND);
      return toAgreementView(updated);
    });
  }

  async contacts(lenderId: string, ability: AppAbility) {
    await this.visible(lenderId, ability, AppAction.Read);
    return { items: (await this.lenders.contacts(lenderId, false)).map(toContactView) };
  }

  createContact(lenderId: string, input: ContactInput, ability: AppAbility) {
    return runThenInvalidate(this.txHost, this.cache, [LENDER_CACHE_TAG], async () => {
      await this.visible(lenderId, ability, AppAction.Update);
      if ((await this.lenders.countContacts(lenderId)) >= LENDER_CONTACTS_MAX) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'name', code: 'too_many_contacts', message: `a lender can have at most ${LENDER_CONTACTS_MAX} contacts` }] });
      const email = input.email ? normaliseEmail(input.email) : null;
      if (input.email && !email) throw new AppError(ErrorCode.EMAIL_INVALID);
      const mobile = input.mobile ? normaliseMobile(input.mobile, input.countryCode) : null;
      if (input.mobile && !mobile) throw new AppError(ErrorCode.MOBILE_INVALID);
      if (!email && !mobile) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'email', code: 'required', message: 'give an email or a mobile' }] });
      const contact = await this.lenders.createContact({
        lenderId,
        name: input.name,
        designation: input.designation ?? null,
        role: input.role,
        emailEnc: email ? this.cipher.encrypt(email, CipherPurpose.LenderContact) : null,
        emailMasked: email ? maskEmail(email) : null,
        mobileEnc: mobile ? this.cipher.encrypt(mobile.e164, CipherPurpose.LenderContact) : null,
        mobileMasked: mobile ? maskMobile(mobile.e164) : null,
        escalationLevel: input.escalationLevel ?? 1,
      });
      await this.record(lenderId, AuditAction.LenderContactCreated, { contactId: contact.id, role: contact.role });
      return toContactView(contact);
    });
  }

  updateContact(lenderId: string, contactId: string, patch: ContactPatch, expectedVersion: number | undefined, ability: AppAbility) {
    return runThenInvalidate(this.txHost, this.cache, [LENDER_CACHE_TAG], async () => {
      await this.visible(lenderId, ability, AppAction.Update);
      const contact = await this.lenders.findContact(lenderId, contactId);
      if (!contact) throw new AppError(ErrorCode.NOT_FOUND);
      assertVersion(expectedVersion, contact.version);
      const moved = await this.lenders.updateContactVersioned(contactId, contact.version, patch);
      if (moved.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT, { details: { currentVersion: contact.version + 1 } });
      await this.record(lenderId, AuditAction.LenderContactChanged, { contactId, fields: Object.keys(patch) });
      const updated = await this.lenders.findContact(lenderId, contactId);
      if (!updated) throw new AppError(ErrorCode.NOT_FOUND);
      return toContactView(updated);
    });
  }

  private async assertLenderDocument(lender: LenderRow, documentId: string, ability: AppAbility) {
    const document = await this.documents.get(documentId, ability);
    if (document.partyId !== lender.organization.partyId) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'documentId', code: 'not_this_lender', message: 'the document was not uploaded for this lender' }] });
  }

  private async record(lenderId: string, action: AuditAction, metadata: Record<string, unknown>) {
    await this.changes.record({ action, entityType: AuditEntity.Lender, entityId: lenderId, event: EventName.LenderChanged, metadata, payload: { lenderId } });
  }
}
