import type { DocumentType } from '../../../generated/prisma/client.js';
import type { DocumentRow } from '../infrastructure/document.repository.js';

export const toDocumentTypeView = (type: DocumentType) => ({
  id: type.id,
  key: type.key,
  label: type.label,
  description: type.description,
  icon: type.icon,
  acceptedMimeTypes: type.acceptedMimeTypes,
  maxSizeBytes: type.maxSizeBytes,
  periodRule: type.periodRule,
  freshnessDays: type.freshnessDays,
  extractorKey: type.extractorKey,
  producesAttributes: type.producesAttributes,
  retentionDays: type.retentionDays,
  sensitivity: type.sensitivity,
  status: type.status,
  version: type.version,
  updatedAt: type.updatedAt.toISOString(),
});

export type DocumentTypeView = ReturnType<typeof toDocumentTypeView>;

export const toDocumentView = (document: DocumentRow) => ({
  id: document.id,
  documentType: { key: document.documentType.key, label: document.documentType.label },
  partyId: document.partyId,
  borrowerProfileId: document.borrowerProfileId,
  applicationId: document.applicationId,
  source: document.source,
  status: document.status,
  fileName: document.fileName,
  mimeType: document.mimeType,
  sizeBytes: document.sizeBytes,
  pages: document.pages,
  period: { start: document.periodStart?.toISOString().slice(0, 10) ?? null, end: document.periodEnd?.toISOString().slice(0, 10) ?? null },
  passwordProtected: document.passwordEnc !== null,
  rejectReason: document.rejectReason,
  rejectNote: document.rejectNote,
  scannedAt: document.scannedAt?.toISOString() ?? null,
  freshUntil: document.freshUntil?.toISOString() ?? null,
  locked: document.lockedAt !== null,
  uploadedContext: document.uploadedContext,
  version: document.version,
  createdAt: document.createdAt.toISOString(),
  updatedAt: document.updatedAt.toISOString(),
});

export type DocumentView = ReturnType<typeof toDocumentView>;
