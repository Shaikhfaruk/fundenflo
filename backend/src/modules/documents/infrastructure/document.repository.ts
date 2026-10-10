import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { ACTIVE_DOCUMENT_STATES } from '../../../engines/state-machines/machines/document.machine.js';
import type { DocumentStatus, Prisma } from '../../../generated/prisma/client.js';
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

  update(id: string, data: Prisma.DocumentUncheckedUpdateManyInput) {
    return this.txHost.tx.document.updateMany({ where: { id }, data: { ...data, version: { increment: 1 } } });
  }

  async idsOfParty(partyId: string) {
    return (await this.txHost.tx.document.findMany({ where: { partyId }, select: { id: true } })).map((row) => row.id);
  }

  async moveParty(ids: string[], partyId: string) {
    await this.txHost.tx.document.updateMany({ where: { id: { in: ids } }, data: { partyId, version: { increment: 1 } } });
  }
}
