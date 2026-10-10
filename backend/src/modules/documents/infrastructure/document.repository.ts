import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { ACTIVE_DOCUMENT_STATES } from '../../../engines/state-machines/machines/document.machine.js';
import { DocumentStatus } from '../../../common/enums/db.enums.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';

export const documentInclude = {
  documentType: { select: { id: true, key: true, label: true, extractorKey: true } },
} as const satisfies Prisma.DocumentInclude;

export type DocumentRow = Prisma.DocumentGetPayload<{ include: typeof documentInclude }>;

const active = { status: { in: [...ACTIVE_DOCUMENT_STATES] as DocumentStatus[] } };

@Injectable()
export class DocumentRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  create(data: Prisma.DocumentUncheckedCreateInput) {
    return this.txHost.tx.document.create({ data, include: documentInclude });
  }

  findOne(where: Prisma.DocumentWhereInput) {
    return this.txHost.tx.document.findFirst({ where, include: documentInclude });
  }

  list(where: Prisma.DocumentWhereInput, take: number) {
    return this.txHost.tx.document.findMany({ where, include: documentInclude, orderBy: { id: 'desc' }, take });
  }

  findActiveDuplicate(where: { partyId: string; sha256: string; documentTypeId: string; applicationId: string | null }) {
    return this.txHost.tx.document.findFirst({ where: { ...where, ...active }, include: documentInclude });
  }

  countActive(partyId: string) {
    return this.txHost.tx.document.count({ where: { partyId, ...active } });
  }

  heldFor(partyId: string, applicationId: string | null) {
    return this.txHost.tx.document.findMany({
      where: { partyId, ...active, OR: [{ applicationId: null }, ...(applicationId ? [{ applicationId }] : [])] },
      select: { id: true, status: true, fileName: true, freshUntil: true, applicationId: true, createdAt: true, documentType: { select: { key: true } } },
      orderBy: { id: 'asc' },
    });
  }

  async lock(id: string) {
    await this.txHost.tx.$queryRaw`SELECT id FROM documents WHERE id = ${id}::uuid FOR UPDATE`;
  }

  updateFromStatus(id: string, status: DocumentStatus, data: Prisma.DocumentUncheckedUpdateManyInput) {
    return this.txHost.tx.document.updateMany({ where: { id, status }, data: { ...data, version: { increment: 1 } } });
  }

  updateMany(where: Prisma.DocumentWhereInput, data: Prisma.DocumentUncheckedUpdateManyInput) {
    return this.txHost.tx.document.updateMany({ where, data: { ...data, version: { increment: 1 } } });
  }

  update(id: string, data: Prisma.DocumentUncheckedUpdateManyInput) {
    return this.txHost.tx.document.updateMany({ where: { id }, data: { ...data, version: { increment: 1 } } });
  }

  createExtraction(data: Prisma.DocumentExtractionUncheckedCreateInput) {
    return this.txHost.tx.documentExtraction.create({ data });
  }

  extractions(documentId: string) {
    return this.txHost.tx.documentExtraction.findMany({ where: { documentId }, orderBy: { createdAt: 'desc' } });
  }

  async scannedForProfiles(borrowerProfileIds: string[], take: number) {
    return (await this.txHost.tx.document.findMany({ where: { borrowerProfileId: { in: borrowerProfileIds }, status: DocumentStatus.scanned }, select: { id: true }, orderBy: { id: 'asc' }, take })).map((row) => row.id);
  }

  async partiesWithSha(sha256: string, excludePartyId: string, take: number) {
    return [...new Set((await this.txHost.tx.document.findMany({ where: { sha256, partyId: { not: excludePartyId }, status: { notIn: [DocumentStatus.deleted, DocumentStatus.purged] } }, select: { partyId: true }, take })).map((row) => row.partyId))];
  }

  listForParties(partyIds: string[]) {
    return this.txHost.tx.document.findMany({ where: { partyId: { in: partyIds }, status: { notIn: [DocumentStatus.deleted, DocumentStatus.purged] } }, include: documentInclude, orderBy: { createdAt: 'asc' } });
  }

  async idsOfParty(partyId: string) {
    return (await this.txHost.tx.document.findMany({ where: { partyId }, select: { id: true } })).map((row) => row.id);
  }

  async moveParty(ids: string[], partyId: string) {
    await this.txHost.tx.document.updateMany({ where: { id: { in: ids } }, data: { partyId, version: { increment: 1 } } });
  }
}
