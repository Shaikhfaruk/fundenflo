import type { ImportBatch, ImportRow } from '../../../generated/prisma/client.js';

const iso = (value: Date | null) => value?.toISOString() ?? null;

export const toImportView = (batch: ImportBatch, sampleRows: Array<Record<string, string>> | null = null) => ({
  id: batch.id,
  kind: batch.kind,
  status: batch.status,
  fileName: batch.fileName,
  contentType: batch.contentType,
  sizeBytes: batch.sizeBytes,
  columns: batch.columns,
  sampleRows,
  mapping: batch.mapping,
  defaults: batch.defaults,
  counts: {
    total: batch.totalRows,
    valid: batch.validRows,
    invalid: batch.invalidRows,
    committed: batch.committedRows,
    failed: batch.failedRows,
    undone: batch.undoneRows,
  },
  summary: batch.summary,
  error: batch.error,
  createdByUserId: batch.createdByUserId,
  startedAt: iso(batch.startedAt),
  finishedAt: iso(batch.finishedAt),
  version: batch.version,
  createdAt: batch.createdAt.toISOString(),
  updatedAt: batch.updatedAt.toISOString(),
});

export const toImportRowView = (row: ImportRow, values: Record<string, string>) => ({
  id: row.id,
  rowNumber: row.rowNumber,
  status: row.status,
  values,
  issues: row.errors,
  entityId: row.entityId,
});
