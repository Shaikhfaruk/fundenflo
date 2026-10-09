import type { LocalisedText } from '../../../common/i18n/locale.js';
import { configVersionMachine } from '../../../engines/state-machines/machines/config-version.machine.js';
import type { ConfigChangeRequest } from '../../../generated/prisma/client.js';
import { pickActiveVersion } from '../domain/active-version.js';
import type { ChangeRequestWithVersion, ConfigDocumentWithVersions, ConfigVersionWithRequest } from '../infrastructure/config.repository.js';

const iso = (value: Date | null) => value?.toISOString() ?? null;

type VersionSummaryRow = ConfigDocumentWithVersions['versions'][number];

const toVersionSummary = (version: VersionSummaryRow) => ({
  id: version.id,
  number: version.number,
  status: version.status,
  effectiveFrom: iso(version.effectiveFrom),
  publishedAt: iso(version.publishedAt),
  retiredAt: iso(version.retiredAt),
  updatedAt: version.updatedAt.toISOString(),
});

export function toConfigDocumentView(document: ConfigDocumentWithVersions, now: Date) {
  const active = pickActiveVersion(document.versions, now);
  const open = document.versions.find((version) => version.id === document.openVersionId);
  return {
    id: document.id,
    resource: document.resource,
    key: document.key,
    name: document.name as LocalisedText,
    description: (document.description as LocalisedText | null) ?? null,
    status: document.status,
    activeVersion: active ? { id: active.id, number: active.number, effectiveFrom: iso(active.effectiveFrom) } : null,
    openVersion: open ? { id: open.id, number: open.number, status: open.status } : null,
    versions: document.versions.map(toVersionSummary),
    version: document.version,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

const toChangeRequestSummary = (request: ConfigChangeRequest) => ({
  id: request.id,
  status: request.status,
  makerUserId: request.makerUserId,
  checkerUserId: request.checkerUserId,
  reason: request.reason,
  decisionNote: request.decisionNote,
  createdAt: request.createdAt.toISOString(),
  decidedAt: iso(request.decidedAt),
});

export function toConfigVersionView(version: ConfigVersionWithRequest) {
  const latest = version.changeRequests[0];
  return {
    id: version.id,
    resource: version.document.resource,
    documentId: version.documentId,
    documentKey: version.document.key,
    number: version.number,
    status: version.status,
    content: version.content,
    compiled: version.compiled,
    issues: version.issues ?? [],
    contentHash: version.contentHash,
    notes: version.notes,
    effectiveFrom: iso(version.effectiveFrom),
    publishedAt: iso(version.publishedAt),
    retiredAt: iso(version.retiredAt),
    createdByUserId: version.createdByUserId,
    submittedByUserId: version.submittedByUserId,
    approvedByUserId: version.approvedByUserId,
    publishedByUserId: version.publishedByUserId,
    retiredByUserId: version.retiredByUserId,
    changeRequest: latest ? toChangeRequestSummary(latest) : null,
    availableActions: configVersionMachine.events(version.status),
    version: version.version,
    createdAt: version.createdAt.toISOString(),
    updatedAt: version.updatedAt.toISOString(),
  };
}

export const toChangeRequestView = (request: ChangeRequestWithVersion) => ({
  ...toChangeRequestSummary(request),
  resource: request.resource,
  documentId: request.configVersion.document.id,
  documentKey: request.configVersion.document.key,
  versionId: request.versionId,
  versionNumber: request.configVersion.number,
  versionStatus: request.configVersion.status,
  diff: request.diff,
});
