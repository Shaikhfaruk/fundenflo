import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { CatalogStatus, ChangeRequestStatus, type ConfigResource, ConfigVersionStatus } from '../../../common/enums/db.enums.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';
import { CONFIG_VERSION_SUMMARY_LIMIT } from '../domain/config.constants.js';

const VERSION_SUMMARY = {
  select: { id: true, number: true, status: true, effectiveFrom: true, publishedAt: true, retiredAt: true, updatedAt: true },
  orderBy: { number: 'desc' },
} as const satisfies Prisma.ConfigDocument$versionsArgs;

const LATEST_CHANGE_REQUEST = { orderBy: { createdAt: 'desc' }, take: 1 } as const satisfies Prisma.ConfigVersion$changeRequestsArgs;

const CHANGE_REQUEST_INCLUDE = {
  configVersion: { select: { id: true, number: true, status: true, document: { select: { id: true, key: true, resource: true } } } },
} as const satisfies Prisma.ConfigChangeRequestInclude;

export type ConfigDocumentWithVersions = Prisma.ConfigDocumentGetPayload<{ include: { versions: typeof VERSION_SUMMARY } }>;
export type ConfigVersionWithRequest = Prisma.ConfigVersionGetPayload<{ include: { changeRequests: typeof LATEST_CHANGE_REQUEST; document: true } }>;
export type ChangeRequestWithVersion = Prisma.ConfigChangeRequestGetPayload<{ include: typeof CHANGE_REQUEST_INCLUDE }>;

@Injectable()
export class ConfigRepository {
  constructor(private readonly txHost: TransactionHost<PrismaTx>) {}

  listDocuments(resource: ConfigResource, status: CatalogStatus | undefined, take: number, idFilter?: { lt: string }) {
    return this.txHost.tx.configDocument.findMany({
      where: { resource, status, id: idFilter },
      include: { versions: { ...VERSION_SUMMARY, take: CONFIG_VERSION_SUMMARY_LIMIT } },
      orderBy: { id: 'desc' },
      take,
    });
  }

  findDocument(resource: ConfigResource, id: string): Promise<ConfigDocumentWithVersions | null> {
    return this.txHost.tx.configDocument.findFirst({ where: { id, resource }, include: { versions: VERSION_SUMMARY } });
  }

  createDocument(data: Prisma.ConfigDocumentUncheckedCreateInput) {
    return this.txHost.tx.configDocument.create({ data });
  }

  updateDocumentVersioned(id: string, version: number, data: Prisma.ConfigDocumentUpdateManyMutationInput) {
    return this.txHost.tx.configDocument.updateMany({ where: { id, version }, data: { ...data, version: { increment: 1 } } });
  }

  async claimOpenVersion(documentId: string, versionId: string): Promise<number | null> {
    const claimed = await this.txHost.tx.configDocument.updateManyAndReturn({
      where: { id: documentId, openVersionId: null },
      data: { openVersionId: versionId, latestNumber: { increment: 1 } },
      select: { latestNumber: true },
    });
    return claimed[0]?.latestNumber ?? null;
  }

  releaseOpenVersion(documentId: string, versionId: string) {
    return this.txHost.tx.configDocument.updateMany({ where: { id: documentId, openVersionId: versionId }, data: { openVersionId: null } });
  }

  findVersion(documentId: string, number: number): Promise<ConfigVersionWithRequest | null> {
    return this.txHost.tx.configVersion.findUnique({
      where: { documentId_number: { documentId, number } },
      include: { changeRequests: LATEST_CHANGE_REQUEST, document: true },
    });
  }

  findVersionById(id: string) {
    return this.txHost.tx.configVersion.findUnique({ where: { id }, include: { document: true } });
  }

  latestVersionWith(documentId: string, statuses: ConfigVersionStatus[]) {
    return this.txHost.tx.configVersion.findFirst({ where: { documentId, status: { in: statuses } }, orderBy: { number: 'desc' } });
  }

  createVersion(data: Prisma.ConfigVersionUncheckedCreateInput) {
    return this.txHost.tx.configVersion.create({ data });
  }

  updateVersionGuarded(id: string, guard: { status: ConfigVersionStatus; version?: number }, data: Prisma.ConfigVersionUncheckedUpdateManyInput) {
    return this.txHost.tx.configVersion.updateMany({ where: { id, ...guard }, data: { ...data, version: { increment: 1 } } });
  }

  documentNames(resource: ConfigResource, ids: string[]) {
    return this.txHost.tx.configDocument.findMany({ where: { resource, id: { in: ids } }, select: { id: true, name: true } });
  }

  listPublished(resource: ConfigResource) {
    return this.txHost.tx.configVersion.findMany({
      where: { status: ConfigVersionStatus.published, document: { resource, status: CatalogStatus.active } },
      select: { id: true, number: true, effectiveFrom: true, compiled: true, documentId: true, document: { select: { key: true } } },
      orderBy: [{ documentId: 'asc' }, { number: 'desc' }],
    });
  }

  createChangeRequest(data: Prisma.ConfigChangeRequestUncheckedCreateInput) {
    return this.txHost.tx.configChangeRequest.create({ data });
  }

  findChangeRequest(id: string): Promise<ChangeRequestWithVersion | null> {
    return this.txHost.tx.configChangeRequest.findUnique({ where: { id }, include: CHANGE_REQUEST_INCLUDE });
  }

  decideChangeRequest(id: string, data: Prisma.ConfigChangeRequestUncheckedUpdateManyInput) {
    return this.txHost.tx.configChangeRequest.updateMany({ where: { id, status: ChangeRequestStatus.pending }, data });
  }

  withdrawPendingChangeRequests(versionId: string) {
    return this.txHost.tx.configChangeRequest.updateMany({
      where: { versionId, status: ChangeRequestStatus.pending },
      data: { status: ChangeRequestStatus.withdrawn, decidedAt: new Date() },
    });
  }

  listChangeRequests(filters: { status?: ChangeRequestStatus; resources: ConfigResource[] }, take: number, idFilter?: { lt: string }) {
    return this.txHost.tx.configChangeRequest.findMany({
      where: { status: filters.status, resource: { in: filters.resources }, id: idFilter },
      include: CHANGE_REQUEST_INCLUDE,
      orderBy: { id: 'desc' },
      take,
    });
  }
}
