import { accessibleBy } from '@casl/prisma/runtime';
import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { PartyKind } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { EventName } from '../../../common/events/event-names.js';
import { assertVersion } from '../../../common/http/versioning.js';
import { DEFAULT_LOCALE } from '../../../common/i18n/locale.js';
import { type PageQuery, pageWindow, toPage } from '../../../common/listing/cursor-page.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { CatalogQueryService } from '../../catalog/application/catalog-query.service.js';
import { PartyService } from '../../parties/application/party.service.js';
import { BorrowerSegment, DEFAULT_BUSINESS_RELATIONSHIP, SUB_SEGMENT_RELATIONSHIP } from '../domain/borrower.constants.js';
import { BorrowerProfileRepository } from '../infrastructure/borrower-profile.repository.js';
import { toBorrowerProfileView } from './borrower.views.js';

export type BorrowerProfileInput = { segment: string; subSegment?: string; businessName?: string; incorporatedOn?: string };

export type BorrowerProfilePatch = { subSegment?: string | null; incorporatedOn?: string | null; businessName?: string };

const toDate = (value: string | null | undefined) => (value ? new Date(`${value}T00:00:00.000Z`) : value === null ? null : undefined);

@Injectable()
export class BorrowerProfileService {
  constructor(
    private readonly profiles: BorrowerProfileRepository,
    private readonly parties: PartyService,
    private readonly catalog: CatalogQueryService,
    private readonly changes: ChangeRecorder,
  ) {}

  @Transactional()
  async ensure(actingPartyId: string, input: BorrowerProfileInput, createdByUserId: string, partnerOrganizationId: string | null = null) {
    await this.assertSegment(input.segment, input.subSegment);
    const partyId = input.segment === BorrowerSegment.Individual ? actingPartyId : await this.businessFor(actingPartyId, input);
    const existing = await this.profiles.findByParty(partyId);
    if (existing) {
      if (partnerOrganizationId && existing.partnerOrganizationId !== partnerOrganizationId) throw new AppError(ErrorCode.BORROWER_ALREADY_REGISTERED);
      return toBorrowerProfileView(existing);
    }
    const profile = await this.profiles.create({
      partyId,
      actingPartyId,
      segmentKey: input.segment,
      subSegmentKey: input.subSegment ?? null,
      incorporatedOn: toDate(input.incorporatedOn) ?? null,
      createdByUserId,
      partnerOrganizationId,
    });
    await this.changes.record({ action: AuditAction.BorrowerProfileCreated, entityType: AuditEntity.BorrowerProfile, entityId: profile.id, event: EventName.BorrowerProfileChanged, metadata: { segment: input.segment, partnerOrganizationId }, payload: { borrowerProfileId: profile.id, partyId } });
    return toBorrowerProfileView(profile);
  }

  async list(ability: AppAbility, query: PageQuery) {
    const window = pageWindow(query);
    return toPage(await this.profiles.list({ AND: [accessibleBy(ability, AppAction.Read).ofType('BorrowerProfile'), { id: window.idFilter }] }, window.take), query.limit, toBorrowerProfileView);
  }

  async get(id: string, ability: AppAbility, action: AppAction = AppAction.Read) {
    const profile = await this.profiles.findOne({ AND: [accessibleBy(ability, action).ofType('BorrowerProfile'), { id }] });
    if (!profile) throw new AppError(ErrorCode.NOT_FOUND);
    return profile;
  }

  async actingPartyOf(borrowerProfileId: string): Promise<string | null> {
    return (await this.profiles.findOne({ id: borrowerProfileId }))?.actingPartyId ?? null;
  }

  async profileIdsActedBy(partyId: string): Promise<string[]> {
    return (await this.profiles.idsOfParty(partyId)).acting;
  }

  @Transactional()
  async update(id: string, patch: BorrowerProfilePatch, expectedVersion: number | undefined, ability: AppAbility) {
    const profile = await this.get(id, ability, AppAction.Update);
    assertVersion(expectedVersion, profile.version);
    if (patch.subSegment) await this.assertSegment(profile.segmentKey, patch.subSegment);
    if (patch.businessName) {
      if (profile.party.kind !== PartyKind.business) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'businessName', code: 'not_a_business', message: 'only business profiles have a business name' }] });
      await this.parties.updateProfile(profile.partyId, { displayName: patch.businessName }, undefined);
    }
    const moved = await this.profiles.updateVersioned(id, profile.version, { subSegmentKey: patch.subSegment, incorporatedOn: toDate(patch.incorporatedOn) });
    if (moved.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT, { details: { currentVersion: profile.version + 1 } });
    await this.changes.record({ action: AuditAction.BorrowerProfileChanged, entityType: AuditEntity.BorrowerProfile, entityId: id, event: EventName.BorrowerProfileChanged, metadata: { fields: Object.keys(patch) }, payload: { borrowerProfileId: id, partyId: profile.partyId } });
    return toBorrowerProfileView(await this.get(id, ability));
  }

  private async businessFor(actingPartyId: string, input: BorrowerProfileInput) {
    const name = input.businessName?.trim();
    if (!name) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'businessName', code: 'required', message: 'a business borrower needs the business name' }] });
    const existing = (await this.parties.businessesOf(actingPartyId)).find((party) => party.displayName?.trim().toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;
    const business = await this.parties.createBusiness({ displayName: name });
    await this.parties.linkRelationship(actingPartyId, business.id, (input.subSegment ? SUB_SEGMENT_RELATIONSHIP[input.subSegment] : undefined) ?? DEFAULT_BUSINESS_RELATIONSHIP);
    return business.id;
  }

  private async assertSegment(segment: string, subSegment: string | undefined) {
    const segments = await this.catalog.segments(DEFAULT_LOCALE);
    const found = segments.find((candidate) => candidate.key === segment);
    if (!found) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'segment', code: 'unknown_key', message: `unknown or inactive segment ${segment}` }] });
    if (subSegment && !found.subSegments.some((candidate) => candidate.key === subSegment)) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'subSegment', code: 'unknown_key', message: `${subSegment} is not a sub-segment of ${segment}` }] });
    }
  }
}
