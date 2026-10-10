import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { UserActor } from '../../../common/context/actor.js';
import { InvitationStatus, OrganizationStatus, OrganizationType, type PartnerKind, type PartnerLevel, PartnerVerificationStatus } from '../../../common/enums/db.enums.js';
import { EventName } from '../../../common/events/event-names.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { assertVersion } from '../../../common/http/versioning.js';
import { type PageQuery } from '../../../common/listing/cursor-page.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';
import { toInvitationRecipient } from '../../access/application/invitation-recipient.js';
import { InvitationService } from '../../access/application/invitation.service.js';
import { type MembershipPatch, MembershipService } from '../../access/application/membership.service.js';
import { OrganizationService } from '../../access/application/organization.service.js';
import type { AppAbility } from '../../access/domain/ability.types.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { CatalogQueryService } from '../../catalog/application/catalog-query.service.js';
import { GeoService } from '../../catalog/application/geo.service.js';
import type { ConfigIssue } from '../../config-publishing/domain/config.types.js';
import { OPEN_REGISTRATION_STATUSES, PARTNER_MEMBER_ROLE, PARTNER_OWNER_ROLE } from '../domain/partner.constants.js';
import { PartnerRepository } from '../infrastructure/partner.repository.js';
import { toCapacityView, toPartnerView, toServiceAreaView } from './partner.views.js';

export type Capabilities = { segments?: string[]; categories?: string[]; languages?: string[] };

export type CapacityInput = Capabilities & {
  maxOpenLeads?: number | null;
  paused?: boolean;
  workingDays?: number[];
  workingHours?: { start: string; end: string } | null;
};

export type ServiceAreaInput = { stateGstCode?: string; cityId?: string; pincode?: string };

type ResolvedArea = { stateId?: string; cityId?: string; pincode?: string | null };

export type RoutingPoolFilter = {
  kinds?: PartnerKind[];
  levels?: PartnerLevel[];
  organizationIds?: string[];
  location: { stateId: string | null; cityId: string | null; pincode: string | null };
  segment: string | null;
  category: string | null;
  language: string | null;
  requireServiceArea: boolean;
  requireCapabilities: boolean;
  requireLanguage: boolean;
};

const listAllows = (field: 'segments' | 'categories' | 'languages', value: string): Prisma.PartnerProfileWhereInput => ({ OR: [{ [field]: { isEmpty: true } }, { [field]: { has: value } }] });

export type SignupInput = Capabilities & {
  kind: PartnerKind;
  firmName: string;
  membershipNumber?: string;
  firmRegistrationNumber?: string;
  serviceAreas?: ServiceAreaInput[];
};

@Injectable()
export class PartnerService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTx>,
    private readonly partners: PartnerRepository,
    private readonly organizations: OrganizationService,
    private readonly memberships: MembershipService,
    private readonly invitations: InvitationService,
    private readonly catalog: CatalogQueryService,
    private readonly geo: GeoService,
    private readonly changes: ChangeRecorder,
  ) {}

  signup(actor: UserActor, input: SignupInput) {
    return this.txHost.withTransaction(async () => {
      const owned = await this.organizations.ownedBy(actor.userId, PARTNER_OWNER_ROLE);
      if (owned.some((membership) => membership.organization && OPEN_REGISTRATION_STATUSES.includes(membership.organization.status))) {
        throw new AppError(ErrorCode.PARTNER_ALREADY_REGISTERED);
      }
      await this.assertCapabilities(input);
      const areas = await this.resolveAreas(input.serviceAreas ?? []);
      const { organization } = await this.organizations.registerPending({ type: OrganizationType.partner, name: input.firmName, ownerUserId: actor.userId, ownerRole: PARTNER_OWNER_ROLE });
      const profile = await this.partners.create({
        organizationId: organization.id,
        kind: input.kind,
        membershipNumber: input.membershipNumber ?? null,
        firmRegistrationNumber: input.firmRegistrationNumber ?? null,
        segments: input.segments ?? [],
        categories: input.categories ?? [],
        languages: input.languages ?? [],
        signedUpByUserId: actor.userId,
      });
      await this.partners.replaceServiceAreas(profile.id, areas);
      await this.changes.record({
        action: AuditAction.PartnerRegistered,
        entityType: AuditEntity.PartnerProfile,
        entityId: profile.id,
        event: EventName.PartnerRegistered,
        metadata: { organizationId: organization.id, kind: input.kind, serviceAreas: areas.length },
        payload: { partnerId: profile.id, organizationId: organization.id, kind: input.kind, ownerUserId: actor.userId },
      });
      return toPartnerView(await this.requireByOrganization(organization.id));
    });
  }

  async summaryOf(organizationId: string) {
    const partner = await this.partners.findByOrganization(organizationId);
    return partner ? { organizationId, name: partner.organization.name, kind: partner.kind, level: partner.level } : null;
  }

  async profile(actor: UserActor) {
    return toPartnerView(await this.requireByOrganization(this.organizationOf(actor)));
  }

  async capacity(actor: UserActor) {
    return toCapacityView(await this.requireByOrganization(this.organizationOf(actor)));
  }

  setCapacity(actor: UserActor, input: CapacityInput, expectedVersion: number | undefined) {
    return this.txHost.withTransaction(async () => {
      const partner = await this.requireByOrganization(this.organizationOf(actor));
      assertVersion(expectedVersion, partner.version);
      await this.assertCapabilities(input);
      const result = await this.partners.updateVersioned(partner.id, partner.version, {
        maxOpenLeads: input.maxOpenLeads,
        paused: input.paused,
        workingDays: input.workingDays ? [...new Set(input.workingDays)].toSorted((left, right) => left - right) : undefined,
        workingHoursStart: input.workingHours === undefined ? undefined : (input.workingHours?.start ?? null),
        workingHoursEnd: input.workingHours === undefined ? undefined : (input.workingHours?.end ?? null),
        segments: input.segments,
        categories: input.categories,
        languages: input.languages,
      });
      if (result.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT, { details: { currentVersion: partner.version + 1 } });
      await this.changes.record({
        action: AuditAction.PartnerCapacityChanged,
        entityType: AuditEntity.PartnerProfile,
        entityId: partner.id,
        event: EventName.PartnerCapacityChanged,
        metadata: { fields: Object.keys(input) },
        payload: { partnerId: partner.id, organizationId: partner.organizationId },
      });
      return toCapacityView(await this.requireByOrganization(partner.organizationId));
    });
  }

  async serviceAreas(actor: UserActor) {
    return { items: (await this.requireByOrganization(this.organizationOf(actor))).serviceAreas.map(toServiceAreaView) };
  }

  setServiceAreas(actor: UserActor, areas: ServiceAreaInput[]) {
    return this.txHost.withTransaction(async () => {
      const partner = await this.requireByOrganization(this.organizationOf(actor));
      const resolved = await this.resolveAreas(areas);
      await this.partners.replaceServiceAreas(partner.id, resolved);
      await this.changes.record({
        action: AuditAction.PartnerServiceAreasChanged,
        entityType: AuditEntity.PartnerProfile,
        entityId: partner.id,
        event: EventName.PartnerServiceAreasChanged,
        metadata: { count: resolved.length },
        payload: { partnerId: partner.id, organizationId: partner.organizationId },
      });
      return { items: (await this.requireByOrganization(partner.organizationId)).serviceAreas.map(toServiceAreaView) };
    });
  }

  async members(actor: UserActor, ability: AppAbility, query: PageQuery) {
    const organizationId = this.organizationOf(actor);
    const members = await this.memberships.listMembers(organizationId, ability);
    const invitations = await this.invitations.list({ ...query, organizationId, status: InvitationStatus.pending }, ability);
    return { members, invitations: invitations.items };
  }

  async inviteMember(actor: UserActor, ability: AppAbility, mobile: { mobile: string; countryCode?: string }) {
    const created = await this.invitations.create(
      { organizationId: this.organizationOf(actor), role: PARTNER_MEMBER_ROLE, recipient: toInvitationRecipient(mobile) },
      actor.userId,
      ability,
    );
    await this.invitations.deliver(created);
    return created.invitation;
  }

  async updateMember(actor: UserActor, ability: AppAbility, membershipId: string, status: NonNullable<MembershipPatch['status']>, expectedVersion: number | undefined) {
    this.organizationOf(actor);
    return this.memberships.adminUpdate(membershipId, { status }, expectedVersion, ability);
  }

  routingPool(filter: RoutingPoolFilter) {
    const places: Prisma.PartnerServiceAreaWhereInput[] = [];
    if (filter.location.stateId) places.push({ stateId: filter.location.stateId });
    if (filter.location.cityId) places.push({ cityId: filter.location.cityId });
    if (filter.location.pincode) places.push({ pincode: filter.location.pincode });
    const conditions: Prisma.PartnerProfileWhereInput[] = [];
    if (filter.requireServiceArea) conditions.push({ serviceAreas: { some: { OR: places } } });
    if (filter.requireCapabilities && filter.segment) conditions.push(listAllows('segments', filter.segment));
    if (filter.requireCapabilities && filter.category) conditions.push(listAllows('categories', filter.category));
    if (filter.requireLanguage && filter.language) conditions.push(listAllows('languages', filter.language));
    return this.partners.routingPool({
      verificationStatus: PartnerVerificationStatus.verified,
      paused: false,
      organization: { status: OrganizationStatus.active },
      kind: filter.kinds ? { in: filter.kinds } : undefined,
      level: filter.levels ? { in: filter.levels } : undefined,
      organizationId: filter.organizationIds ? { in: filter.organizationIds } : undefined,
      AND: conditions,
    });
  }

  private organizationOf(actor: UserActor): string {
    if (!actor.organizationId) throw new AppError(ErrorCode.CONTEXT_NOT_ALLOWED);
    return actor.organizationId;
  }

  private async requireByOrganization(organizationId: string) {
    const partner = await this.partners.findByOrganization(organizationId);
    if (!partner) throw new AppError(ErrorCode.NOT_FOUND);
    return partner;
  }

  private async assertCapabilities(input: Capabilities) {
    const known = await this.catalog.referenceKeys();
    const issues: ConfigIssue[] = [];
    for (const [field, set] of [['segments', known.segments], ['categories', known.categories]] as const) {
      for (const [index, key] of (input[field] ?? []).entries()) {
        if (!set.has(key)) issues.push({ path: `${field}.${index}`, code: 'unknown_key', message: `unknown or inactive ${field} key ${key}` });
      }
    }
    if (issues.length > 0) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: issues });
  }

  private async resolveAreas(areas: ServiceAreaInput[]) {
    const states = new Map((await this.geo.findActiveStates([...new Set(areas.flatMap((area) => (area.stateGstCode ? [area.stateGstCode] : [])))])).map((state) => [state.gstCode, state.id]));
    const cities = new Set((await this.geo.findActiveCities([...new Set(areas.flatMap((area) => (area.cityId ? [area.cityId] : [])))])).map((city) => city.id));
    const issues: ConfigIssue[] = [];
    const seen = new Set<string>();
    const rows = areas.flatMap((area, index): ResolvedArea[] => {
      const key = area.stateGstCode ? `s:${area.stateGstCode}` : area.cityId ? `c:${area.cityId}` : `p:${area.pincode ?? ''}`;
      if (seen.has(key)) return [];
      seen.add(key);
      if (area.stateGstCode) {
        const stateId = states.get(area.stateGstCode);
        if (!stateId) issues.push({ path: `serviceAreas.${index}.stateGstCode`, code: 'unknown_state', message: `unknown or inactive state ${area.stateGstCode}` });
        return stateId ? [{ stateId }] : [];
      }
      if (area.cityId) {
        if (!cities.has(area.cityId)) issues.push({ path: `serviceAreas.${index}.cityId`, code: 'unknown_city', message: 'city not found' });
        return cities.has(area.cityId) ? [{ cityId: area.cityId }] : [];
      }
      return [{ pincode: area.pincode ?? null }];
    });
    if (issues.length > 0) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: issues });
    return rows;
  }
}
