import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';

export const borrowerProfileInclude = {
  party: { select: { id: true, kind: true, displayName: true } },
  actingParty: { select: { id: true, displayName: true } },
} as const satisfies Prisma.BorrowerProfileInclude;

export type BorrowerProfileRow = Prisma.BorrowerProfileGetPayload<{ include: typeof borrowerProfileInclude }>;

@Injectable()
export class BorrowerProfileRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  create(data: Prisma.BorrowerProfileUncheckedCreateInput) {
    return this.txHost.tx.borrowerProfile.create({ data, include: borrowerProfileInclude });
  }

  findByParty(partyId: string) {
    return this.txHost.tx.borrowerProfile.findUnique({ where: { partyId }, include: borrowerProfileInclude });
  }

  findOne(where: Prisma.BorrowerProfileWhereInput) {
    return this.txHost.tx.borrowerProfile.findFirst({ where, include: borrowerProfileInclude });
  }

  list(where: Prisma.BorrowerProfileWhereInput, take: number) {
    return this.txHost.tx.borrowerProfile.findMany({ where, include: borrowerProfileInclude, orderBy: { id: 'desc' }, take });
  }

  updateVersioned(id: string, version: number, data: Prisma.BorrowerProfileUncheckedUpdateManyInput) {
    return this.txHost.tx.borrowerProfile.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } });
  }
}
