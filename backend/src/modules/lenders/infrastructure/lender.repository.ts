import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { LenderAgreementStatus, LenderStatus } from '../../../common/enums/db.enums.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';

export const lenderInclude = {
  organization: { select: { id: true, name: true, partyId: true, status: true } },
} as const satisfies Prisma.LenderInclude;

export type LenderRow = Prisma.LenderGetPayload<{ include: typeof lenderInclude }>;

const startOfToday = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

@Injectable()
export class LenderRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  create(data: Prisma.LenderUncheckedCreateInput) {
    return this.txHost.tx.lender.create({ data, include: lenderInclude });
  }

  findOne(where: Prisma.LenderWhereInput) {
    return this.txHost.tx.lender.findFirst({ where, include: lenderInclude });
  }

  list(where: Prisma.LenderWhereInput, take: number) {
    return this.txHost.tx.lender.findMany({ where, include: lenderInclude, orderBy: { id: 'desc' }, take });
  }

  updateVersioned(id: string, version: number, data: Prisma.LenderUncheckedUpdateManyInput) {
    return this.txHost.tx.lender.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } });
  }

  async liveLenderIds(now: Date) {
    const today = startOfToday(now);
    const rows = await this.txHost.tx.lender.findMany({
      where: { status: LenderStatus.active, agreements: { some: { status: LenderAgreementStatus.active, validFrom: { lte: today }, OR: [{ validTo: null }, { validTo: { gte: today } }] } } },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  createAgreement(data: Prisma.LenderAgreementUncheckedCreateInput) {
    return this.txHost.tx.lenderAgreement.create({ data });
  }

  agreements(lenderId: string) {
    return this.txHost.tx.lenderAgreement.findMany({ where: { lenderId }, orderBy: { validFrom: 'desc' } });
  }

  findAgreement(lenderId: string, id: string) {
    return this.txHost.tx.lenderAgreement.findFirst({ where: { id, lenderId } });
  }

  updateAgreementVersioned(id: string, version: number, data: Prisma.LenderAgreementUncheckedUpdateManyInput) {
    return this.txHost.tx.lenderAgreement.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } });
  }

  createContact(data: Prisma.LenderContactUncheckedCreateInput) {
    return this.txHost.tx.lenderContact.create({ data });
  }

  contacts(lenderId: string, activeOnly: boolean) {
    return this.txHost.tx.lenderContact.findMany({ where: { lenderId, ...(activeOnly ? { active: true } : {}) }, orderBy: [{ escalationLevel: 'asc' }, { createdAt: 'asc' }] });
  }

  countContacts(lenderId: string) {
    return this.txHost.tx.lenderContact.count({ where: { lenderId } });
  }

  findContact(lenderId: string, id: string) {
    return this.txHost.tx.lenderContact.findFirst({ where: { id, lenderId } });
  }

  updateContactVersioned(id: string, version: number, data: Prisma.LenderContactUncheckedUpdateManyInput) {
    return this.txHost.tx.lenderContact.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } });
  }
}
