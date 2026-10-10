import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { AssignmentStatus, LeadFlag, LeadStatus, OfflineConversionStatus, Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';
import { LEAD_EVENTS_IN_DETAIL } from '../domain/lead.constants.js';

export const leadListInclude = {
  source: { select: { id: true, key: true, kind: true } },
  party: { select: { id: true, displayName: true } },
  businessParty: { select: { id: true, displayName: true } },
  city: { select: { id: true, name: true } },
  state: { select: { gstCode: true, name: true } },
} as const satisfies Prisma.LeadInclude;

export const leadDetailInclude = {
  ...leadListInclude,
  events: { orderBy: { createdAt: 'desc' }, take: LEAD_EVENTS_IN_DETAIL },
  assignments: { orderBy: { offeredAt: 'desc' }, take: LEAD_EVENTS_IN_DETAIL, include: { organization: { select: { id: true, name: true } } } },
} as const satisfies Prisma.LeadInclude;

export const partnerAssignmentInclude = {
  lead: { include: leadListInclude },
} as const satisfies Prisma.LeadAssignmentInclude;

export type LeadListRow = Prisma.LeadGetPayload<{ include: typeof leadListInclude }>;
export type PartnerAssignmentRow = Prisma.LeadAssignmentGetPayload<{ include: typeof partnerAssignmentInclude }>;
export type LeadDetailRow = Prisma.LeadGetPayload<{ include: typeof leadDetailInclude }>;

@Injectable()
export class LeadRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  listSources(where: Prisma.LeadSourceWhereInput) {
    return this.txHost.tx.leadSource.findMany({ where, orderBy: { key: 'asc' } });
  }

  findSource(id: string) {
    return this.txHost.tx.leadSource.findUnique({ where: { id } });
  }

  findSourceByKey(key: string) {
    return this.txHost.tx.leadSource.findUnique({ where: { key } });
  }

  createSource(data: Prisma.LeadSourceCreateInput) {
    return this.txHost.tx.leadSource.create({ data });
  }

  updateSourceVersioned(id: string, version: number, data: Prisma.LeadSourceUpdateManyMutationInput) {
    return this.txHost.tx.leadSource.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } });
  }

  create(data: Prisma.LeadUncheckedCreateInput) {
    return this.txHost.tx.lead.create({ data });
  }

  findDetail(id: string): Promise<LeadDetailRow | null> {
    return this.txHost.tx.lead.findUnique({ where: { id }, include: leadDetailInclude });
  }

  findMany(ids: string[]) {
    return this.txHost.tx.lead.findMany({ where: { id: { in: ids } } });
  }

  findSummaries(ids: string[]) {
    return this.txHost.tx.lead.findMany({ where: { id: { in: ids } }, select: { id: true, ref: true, status: true, consentStatus: true, party: { select: { displayName: true } } } });
  }

  createConversion(data: Prisma.OfflineConversionUncheckedCreateInput) {
    return this.txHost.tx.offlineConversion.create({ data });
  }

  findConversion(where: Prisma.OfflineConversionWhereInput) {
    return this.txHost.tx.offlineConversion.findFirst({ where, include: { lead: { select: { id: true, ref: true, status: true } }, organization: { select: { id: true, name: true } } } });
  }

  listConversions(where: Prisma.OfflineConversionWhereInput, take: number) {
    return this.txHost.tx.offlineConversion.findMany({ where, orderBy: { id: 'desc' }, take, include: { lead: { select: { id: true, ref: true, status: true } }, organization: { select: { id: true, name: true } } } });
  }

  conversionsForAssignment(assignmentId: string) {
    return this.txHost.tx.offlineConversion.findMany({ where: { assignmentId }, orderBy: { createdAt: 'desc' } });
  }

  updateConversionFromStatus(id: string, status: OfflineConversionStatus, data: Prisma.OfflineConversionUncheckedUpdateManyInput) {
    return this.txHost.tx.offlineConversion.updateMany({ where: { id, status }, data: { ...data, version: { increment: 1 } } });
  }

  async leadIdsOfParty(partyId: string) {
    const [person, business] = await Promise.all([
      this.txHost.tx.lead.findMany({ where: { partyId }, select: { id: true } }),
      this.txHost.tx.lead.findMany({ where: { businessPartyId: partyId }, select: { id: true } }),
    ]);
    return { person: person.map((row) => row.id), business: business.map((row) => row.id) };
  }

  async moveLeads(ids: { person: string[]; business: string[] }, partyId: string) {
    await this.txHost.tx.lead.updateMany({ where: { id: { in: ids.person } }, data: { partyId, version: { increment: 1 } } });
    await this.txHost.tx.lead.updateMany({ where: { id: { in: ids.business } }, data: { businessPartyId: partyId, version: { increment: 1 } } });
  }

  addFlag(id: string, flag: LeadFlag) {
    return this.txHost.tx.lead.updateMany({ where: { id, NOT: { flags: { has: flag } } }, data: { flags: { push: flag }, version: { increment: 1 } } });
  }

  findByExternalRef(sourceId: string, externalRef: string) {
    return this.txHost.tx.lead.findUnique({ where: { sourceId_externalRef: { sourceId, externalRef } } });
  }

  findOpenDuplicate(partyId: string, categoryKey: string | null, since: Date, openStatuses: readonly LeadStatus[]) {
    return this.txHost.tx.lead.findFirst({
      where: { partyId, categoryKey, status: { in: [...openStatuses] }, createdAt: { gte: since }, mergedIntoLeadId: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  listOpenForParty(partyId: string, openStatuses: readonly LeadStatus[]) {
    return this.txHost.tx.lead.findMany({ where: { partyId, status: { in: [...openStatuses] } }, include: leadListInclude });
  }

  countForParty(partyId: string) {
    return this.txHost.tx.lead.count({ where: { partyId } });
  }

  findBusinessPartyForPerson(partyId: string, businessName: string) {
    return this.txHost.tx.lead.findFirst({
      where: { partyId, businessParty: { displayName: { equals: businessName, mode: 'insensitive' } } },
      select: { businessPartyId: true },
    });
  }

  list(where: Prisma.LeadWhereInput, take: number): Promise<LeadListRow[]> {
    return this.txHost.tx.lead.findMany({ where, include: leadListInclude, orderBy: { id: 'desc' }, take });
  }

  update(id: string, data: Prisma.LeadUncheckedUpdateInput) {
    return this.txHost.tx.lead.update({ where: { id }, data: { ...data, version: { increment: 1 } } });
  }

  updateVersioned(id: string, version: number, data: Prisma.LeadUncheckedUpdateManyInput) {
    return this.txHost.tx.lead.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } });
  }

  updateFromStatus(id: string, status: LeadStatus, data: Prisma.LeadUncheckedUpdateManyInput) {
    return this.txHost.tx.lead.updateMany({ where: { id, status }, data: { ...data, version: { increment: 1 } } });
  }

  async lockLead(id: string) {
    await this.txHost.tx.$queryRaw`SELECT id FROM leads WHERE id = ${id}::uuid FOR UPDATE`;
  }

  listAssignments(where: Prisma.LeadAssignmentWhereInput, take: number) {
    return this.txHost.tx.leadAssignment.findMany({ where, take, orderBy: { id: 'desc' }, include: partnerAssignmentInclude });
  }

  findLatestAssignment(where: Prisma.LeadAssignmentWhereInput) {
    return this.txHost.tx.leadAssignment.findFirst({ where, orderBy: { offeredAt: 'desc' }, include: partnerAssignmentInclude });
  }

  heldLeadIds(leadIds: string[], organizationId: string, statuses: readonly AssignmentStatus[]) {
    return this.txHost.tx.leadAssignment.findMany({ where: { leadId: { in: leadIds }, organizationId, status: { in: [...statuses] } }, select: { leadId: true }, distinct: ['leadId'] });
  }

  activeAssignmentsForParty(partyId: string, statuses: readonly AssignmentStatus[]) {
    return this.txHost.tx.leadAssignment.findMany({ where: { lead: { partyId }, status: { in: [...statuses] } }, include: { lead: true } });
  }

  assignmentsForLead(leadId: string) {
    return this.txHost.tx.leadAssignment.findMany({ where: { leadId }, orderBy: { offeredAt: 'asc' } });
  }

  workedOrganizationsForParty(partyId: string, statuses: readonly AssignmentStatus[]) {
    return this.txHost.tx.leadAssignment.findMany({ where: { lead: { partyId }, status: { in: [...statuses] } }, select: { organizationId: true }, distinct: ['organizationId'] });
  }

  openAssignmentCounts(organizationIds: string[], statuses: readonly AssignmentStatus[]) {
    return this.txHost.tx.leadAssignment.groupBy({ by: ['organizationId'], where: { organizationId: { in: organizationIds }, status: { in: [...statuses] } }, _count: { organizationId: true } });
  }

  lastOffers(organizationIds: string[]) {
    return this.txHost.tx.leadAssignment.groupBy({ by: ['organizationId'], where: { organizationId: { in: organizationIds } }, _max: { offeredAt: true } });
  }

  createAssignment(data: Prisma.LeadAssignmentUncheckedCreateInput) {
    return this.txHost.tx.leadAssignment.create({ data, include: { organization: { select: { id: true, name: true } } } });
  }

  findAssignment(id: string) {
    return this.txHost.tx.leadAssignment.findUnique({ where: { id }, include: { lead: true, organization: { select: { id: true, name: true } } } });
  }

  updateAssignmentFromStatus(id: string, status: AssignmentStatus, data: Prisma.LeadAssignmentUncheckedUpdateManyInput) {
    return this.txHost.tx.leadAssignment.updateMany({ where: { id, status }, data: { ...data, version: { increment: 1 } } });
  }

  createEvent(data: Prisma.LeadEventUncheckedCreateInput) {
    return this.txHost.tx.leadEvent.create({ data });
  }
}
