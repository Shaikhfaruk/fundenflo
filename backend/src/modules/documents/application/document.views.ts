import type { DocumentType } from '../../../generated/prisma/client.js';

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
