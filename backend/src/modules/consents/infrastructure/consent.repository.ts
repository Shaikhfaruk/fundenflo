import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { ConsentRequestStatus } from '../../../common/enums/db.enums.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';

@Injectable()
export class ConsentRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  listPurposes(where: Prisma.ConsentPurposeWhereInput) {
    return this.txHost.tx.consentPurpose.findMany({ where, orderBy: { key: 'asc' } });
  }

  findPurpose(id: string) {
    return this.txHost.tx.consentPurpose.findUnique({ where: { id } });
  }

  createPurpose(data: Prisma.ConsentPurposeCreateInput) {
    return this.txHost.tx.consentPurpose.create({ data });
  }

  updatePurposeVersioned(id: string, version: number, data: Prisma.ConsentPurposeUpdateManyMutationInput) {
    return this.txHost.tx.consentPurpose.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } });
  }

  createRecords(data: Prisma.ConsentRecordCreateManyInput[]) {
    return this.txHost.tx.consentRecord.createManyAndReturn({ data });
  }

  listRecords(partyId: string, purposeKeys?: string[]) {
    return this.txHost.tx.consentRecord.findMany({
      where: { partyId, ...(purposeKeys ? { purposeKey: { in: purposeKeys } } : {}) },
      orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }],
    });
  }

  createRequest(data: Prisma.ConsentRequestUncheckedCreateInput) {
    return this.txHost.tx.consentRequest.create({ data });
  }

  findRequestByTokenHash(tokenHash: string) {
    return this.txHost.tx.consentRequest.findUnique({ where: { tokenHash } });
  }

  cancelPendingRequests(partyId: string, templateVersionId: string) {
    return this.txHost.tx.consentRequest.updateMany({ where: { partyId, templateVersionId, status: ConsentRequestStatus.pending }, data: { status: ConsentRequestStatus.cancelled } });
  }

  completeRequest(id: string) {
    return this.txHost.tx.consentRequest.updateMany({ where: { id, status: ConsentRequestStatus.pending }, data: { status: ConsentRequestStatus.completed, completedAt: new Date() } });
  }

  expireRequest(id: string) {
    return this.txHost.tx.consentRequest.updateMany({ where: { id, status: ConsentRequestStatus.pending }, data: { status: ConsentRequestStatus.expired } });
  }

  history(partyId: string, purposeKey: string | undefined, take: number, idFilter?: { lt: string }) {
    return this.txHost.tx.consentRecord.findMany({ where: { partyId, purposeKey, id: idFilter }, orderBy: { id: 'desc' }, take });
  }
}
