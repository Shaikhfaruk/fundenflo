import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { ApplicationPartyStatus } from '../../../common/enums/db.enums.js';
import type { ApplicationPartyRole, ApplicationStatus, Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';

export const applicationInclude = {
  party: { select: { id: true, kind: true, displayName: true } },
  actingParty: { select: { id: true, displayName: true } },
} as const satisfies Prisma.LoanApplicationInclude;

export type ApplicationRow = Prisma.LoanApplicationGetPayload<{ include: typeof applicationInclude }>;

export const applicationPartyInclude = {
  party: { select: { id: true, kind: true, displayName: true } },
} as const satisfies Prisma.ApplicationPartyInclude;

export type ApplicationPartyRow = Prisma.ApplicationPartyGetPayload<{ include: typeof applicationPartyInclude }>;

@Injectable()
export class ApplicationRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  create(data: Prisma.LoanApplicationUncheckedCreateInput) {
    return this.txHost.tx.loanApplication.create({ data, include: applicationInclude });
  }

  findOne(where: Prisma.LoanApplicationWhereInput) {
    return this.txHost.tx.loanApplication.findFirst({ where, include: applicationInclude });
  }

  list(where: Prisma.LoanApplicationWhereInput, take: number) {
    return this.txHost.tx.loanApplication.findMany({ where, include: applicationInclude, orderBy: { id: 'desc' }, take });
  }

  async lock(id: string) {
    await this.txHost.tx.$queryRaw`SELECT id FROM loan_applications WHERE id = ${id}::uuid FOR UPDATE`;
  }

  updateVersioned(id: string, version: number, data: Prisma.LoanApplicationUncheckedUpdateManyInput) {
    return this.txHost.tx.loanApplication.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } });
  }

  updateFromStatus(id: string, status: ApplicationStatus, data: Prisma.LoanApplicationUncheckedUpdateManyInput) {
    return this.txHost.tx.loanApplication.updateMany({ where: { id, status }, data: { ...data, version: { increment: 1 } } });
  }

  update(id: string, data: Prisma.LoanApplicationUncheckedUpdateManyInput) {
    return this.txHost.tx.loanApplication.updateMany({ where: { id }, data: { ...data, version: { increment: 1 } } });
  }

  createEvent(data: Prisma.ApplicationEventUncheckedCreateInput) {
    return this.txHost.tx.applicationEvent.create({ data });
  }

  events(applicationId: string, take: number) {
    return this.txHost.tx.applicationEvent.findMany({ where: { applicationId }, orderBy: { id: 'desc' }, take });
  }

  openForParties(partyIds: string[], statuses: ApplicationStatus[], take: number) {
    return this.txHost.tx.loanApplication.findMany({ where: { status: { in: statuses }, OR: [{ partyId: { in: partyIds } }, { actingPartyId: { in: partyIds } }] }, select: { id: true }, orderBy: { id: 'asc' }, take });
  }

  async idsOfParty(partyId: string) {
    const party = await this.txHost.tx.loanApplication.findMany({ where: { partyId }, select: { id: true } });
    const acting = await this.txHost.tx.loanApplication.findMany({ where: { actingPartyId: partyId }, select: { id: true } });
    return { party: party.map((row) => row.id), acting: acting.map((row) => row.id) };
  }

  async moveParty(ids: { party: string[]; acting: string[] }, partyId: string) {
    await this.txHost.tx.loanApplication.updateMany({ where: { id: { in: ids.party } }, data: { partyId, version: { increment: 1 } } });
    await this.txHost.tx.loanApplication.updateMany({ where: { id: { in: ids.acting } }, data: { actingPartyId: partyId, version: { increment: 1 } } });
  }

  createParty(data: Prisma.ApplicationPartyUncheckedCreateInput) {
    return this.txHost.tx.applicationParty.create({ data, include: applicationPartyInclude });
  }

  parties(applicationId: string, status?: ApplicationPartyStatus) {
    return this.txHost.tx.applicationParty.findMany({ where: { applicationId, status }, include: applicationPartyInclude, orderBy: { createdAt: 'asc' } });
  }

  findParty(where: Prisma.ApplicationPartyWhereInput) {
    return this.txHost.tx.applicationParty.findFirst({ where, include: applicationPartyInclude });
  }

  countParties(applicationId: string, roles: ApplicationPartyRole[]) {
    return this.txHost.tx.applicationParty.count({ where: { applicationId, role: { in: roles }, status: ApplicationPartyStatus.active } });
  }

  updateParty(id: string, data: Prisma.ApplicationPartyUncheckedUpdateManyInput) {
    return this.txHost.tx.applicationParty.updateMany({ where: { id }, data: { ...data, version: { increment: 1 } } });
  }

  updatePartiesWhere(where: Prisma.ApplicationPartyWhereInput, data: Prisma.ApplicationPartyUncheckedUpdateManyInput) {
    return this.txHost.tx.applicationParty.updateMany({ where, data: { ...data, version: { increment: 1 } } });
  }

  async sharedApplications(sourceId: string, targetId: string) {
    const source = await this.txHost.tx.applicationParty.findMany({ where: { partyId: sourceId }, select: { applicationId: true } });
    const shared = await this.txHost.tx.applicationParty.findMany({ where: { partyId: targetId, applicationId: { in: source.map((row) => row.applicationId) } }, select: { applicationId: true } });
    return shared.map((row) => row.applicationId);
  }

  async partyRowIdsOfParty(partyId: string) {
    return (await this.txHost.tx.applicationParty.findMany({ where: { partyId }, select: { id: true } })).map((row) => row.id);
  }

  async movePartyRows(ids: string[], partyId: string) {
    await this.txHost.tx.applicationParty.updateMany({ where: { id: { in: ids } }, data: { partyId, version: { increment: 1 } } });
  }
}
