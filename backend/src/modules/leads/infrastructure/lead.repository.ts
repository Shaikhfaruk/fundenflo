import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { LeadStatus, Prisma } from '../../../generated/prisma/client.js';
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
} as const satisfies Prisma.LeadInclude;

export type LeadListRow = Prisma.LeadGetPayload<{ include: typeof leadListInclude }>;
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

  createEvent(data: Prisma.LeadEventUncheckedCreateInput) {
    return this.txHost.tx.leadEvent.create({ data });
  }
}
