import { Transactional } from '@nestjs-cls/transactional';
import { Injectable, Logger } from '@nestjs/common';

import type { UserActor } from '../../../common/context/actor.js';
import { type ImportKind, ImportRowStatus, type ImportStatus } from '../../../common/enums/db.enums.js';
import { EventName } from '../../../common/events/event-names.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { transitionOrThrow } from '../../../common/errors/transition.js';
import { assertVersion } from '../../../common/http/versioning.js';
import { uuidv7 } from '../../../common/ids/uuid-v7.js';
import { type PageQuery, pageWindow, toPage } from '../../../common/listing/cursor-page.js';
import { parseOrThrow } from '../../../common/validation/zod-validation.pipe.js';
import { ImportBatchEvent, importBatchMachine } from '../../../engines/state-machines/machines/import-batch.machine.js';
import type { ImportBatch, Prisma } from '../../../generated/prisma/client.js';
import { CipherPurpose } from '../../../infrastructure/crypto/crypto.constants.js';
import { FieldCipher } from '../../../infrastructure/crypto/field-cipher.service.js';
import { QueueName } from '../../../infrastructure/queue/queue-names.js';
import { QueueRegistry } from '../../../infrastructure/queue/queue-registry.service.js';
import { type ObjectStorage, InjectObjectStorage } from '../../../infrastructure/storage/storage.port.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import {
  IMPORT_CONTENT_TYPES,
  IMPORT_ROW_CHUNK,
  IMPORT_SAMPLE_ROWS,
  IMPORT_UPLOAD_URL_TTL_SECONDS,
  ImportFormat,
  ImportJob,
  ImportWarning,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  MAX_XLSX_BYTES,
} from '../domain/import.constants.js';
import type { ImportHandler, ImportRowIssue } from '../domain/import.types.js';
import { ImportRepository } from '../infrastructure/import.repository.js';
import { readTable } from '../infrastructure/table-reader.js';
import { ImportHandlerRegistry } from './import-handler.registry.js';
import { toImportRowView, toImportView } from './import.views.js';

export type CreateImportInput = { kind: ImportKind; fileName: string };

export type ImportMappingInput = { mapping: Record<string, string>; defaults: unknown };

type Values = Record<string, string>;

const formatOf = (fileName: string): ImportFormat | null => {
  const extension = fileName.toLowerCase().split('.').at(-1);
  if (extension === ImportFormat.Csv) return ImportFormat.Csv;
  if (extension === ImportFormat.Xlsx) return ImportFormat.Xlsx;
  return null;
};

const safeName = (fileName: string) => fileName.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-120);

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    private readonly imports: ImportRepository,
    private readonly registry: ImportHandlerRegistry,
    private readonly cipher: FieldCipher,
    private readonly queues: QueueRegistry,
    private readonly changes: ChangeRecorder,
    @InjectObjectStorage() private readonly storage: ObjectStorage,
  ) {}

  fields(kind: ImportKind) {
    return { kind, fields: this.registry.get(kind).fields };
  }

  @Transactional()
  async create(input: CreateImportInput, actor: UserActor) {
    this.registry.get(input.kind);
    const format = formatOf(input.fileName);
    if (!format) throw this.invalid('fileName', 'unsupported_format', 'upload a .csv or .xlsx file');
    const id = uuidv7();
    const contentType = IMPORT_CONTENT_TYPES[format];
    const batch = await this.imports.create({ id, kind: input.kind, fileName: input.fileName, contentType, storageKey: `imports/${id}/${safeName(input.fileName)}`, createdByUserId: actor.userId });
    await this.changes.record({ action: AuditAction.ImportCreated, entityType: AuditEntity.ImportBatch, entityId: id, event: EventName.ImportChanged, metadata: { kind: input.kind, fileName: input.fileName } });
    const url = await this.storage.createUploadUrl(batch.storageKey, { ttlSeconds: IMPORT_UPLOAD_URL_TTL_SECONDS, contentType });
    return {
      batch: toImportView(batch),
      upload: { method: 'PUT', url, headers: { 'x-ms-blob-type': 'BlockBlob', 'Content-Type': contentType }, expiresAt: new Date(Date.now() + IMPORT_UPLOAD_URL_TTL_SECONDS * 1000).toISOString() },
    };
  }

  async list(query: PageQuery & { kind?: ImportKind; status?: ImportStatus }) {
    const window = pageWindow(query);
    return toPage(await this.imports.list({ id: window.idFilter, kind: query.kind, status: query.status }, window.take), query.limit, (batch) => toImportView(batch));
  }

  async get(id: string) {
    const batch = await this.require(id);
    return toImportView(batch, batch.sampleRowsEnc ? this.cipher.decryptJson<Values[]>(batch.sampleRowsEnc, CipherPurpose.ImportSample) : null);
  }

  async inspect(id: string) {
    const batch = await this.require(id);
    const next = transitionOrThrow(importBatchMachine, batch.status, ImportBatchEvent.Inspect);
    const stat = await this.storage.stat(batch.storageKey);
    if (!stat) throw this.invalid('file', 'not_uploaded', 'upload the file to the upload URL first');
    const format = formatOf(batch.fileName) ?? ImportFormat.Csv;
    const limit = format === ImportFormat.Xlsx ? MAX_XLSX_BYTES : MAX_IMPORT_BYTES;
    if (stat.sizeBytes > limit) throw this.invalid('file', 'too_big', `files of this type may be at most ${limit} bytes; use CSV for very large lists`);
    const { headers, rows } = await this.sample(batch, format);
    if (headers.length === 0) throw this.invalid('file', 'empty', 'the file has no header row');
    await this.move(batch, next, { sizeBytes: stat.sizeBytes, columns: headers, sampleRowsEnc: this.cipher.encryptJson(rows, CipherPurpose.ImportSample) });
    return this.get(id);
  }

  @Transactional()
  async setMapping(id: string, input: ImportMappingInput, expectedVersion: number | undefined) {
    const batch = await this.require(id);
    assertVersion(expectedVersion, batch.version);
    const next = transitionOrThrow(importBatchMachine, batch.status, ImportBatchEvent.Map);
    const handler = this.registry.get(batch.kind);
    const fieldKeys = new Set(handler.fields.map((field) => field.key));
    const issues: ImportRowIssue[] = [];
    for (const [field, column] of Object.entries(input.mapping)) {
      if (!fieldKeys.has(field)) issues.push({ field, column, code: 'unknown_field', message: `${field} is not an importable field` });
      if (!batch.columns.includes(column)) issues.push({ field, column, code: 'unknown_column', message: `the file has no column "${column}"` });
    }
    const defaults = parseOrThrow(handler.defaultsSchema, input.defaults, 'defaults');
    issues.push(...(await handler.checkDefaults(defaults)));
    if (issues.length > 0) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: issues.map((issue) => ({ path: `mapping.${issue.field}`, code: issue.code, message: issue.message })) });
    await this.move(batch, next, { mapping: input.mapping, defaults: defaults as Prisma.InputJsonValue, error: null });
    await this.changes.record({ action: AuditAction.ImportChanged, entityType: AuditEntity.ImportBatch, entityId: id, event: EventName.ImportChanged, metadata: { fields: Object.keys(input.mapping) } });
    return this.get(id);
  }

  async start(id: string, job: ImportJob) {
    const batch = await this.require(id);
    const event = { [ImportJob.Validate]: ImportBatchEvent.Validate, [ImportJob.Commit]: ImportBatchEvent.Commit, [ImportJob.Undo]: ImportBatchEvent.Undo }[job];
    const next = transitionOrThrow(importBatchMachine, batch.status, event);
    await this.move(batch, next, { startedAt: new Date(), finishedAt: null, error: null });
    await this.queues.get(QueueName.ImportsProcess).add(job, { batchId: id }, { jobId: `${id}:${job}:${batch.version + 1}` });
    return this.get(id);
  }

  async rows(id: string, statuses: ImportRowStatus[], query: PageQuery) {
    await this.require(id);
    const window = pageWindow(query);
    const rows = await this.imports.rowsPage(id, statuses, window.take, window.idFilter);
    return toPage(rows, query.limit, (row) => toImportRowView(row, this.cipher.decryptJson<Values>(row.rawEnc, CipherPurpose.ImportRow)));
  }

  async run(id: string, job: ImportJob) {
    const batch = await this.require(id);
    const handler = this.registry.get(batch.kind);
    if (job === ImportJob.Validate) return this.validate(batch, handler);
    if (job === ImportJob.Commit) return this.commit(batch, handler);
    return this.undo(batch, handler);
  }

  private async validate(batch: ImportBatch, handler: ImportHandler) {
    try {
      await this.imports.deleteRows(batch.id);
      const mapping = batch.mapping as Record<string, string>;
      const defaults = handler.defaultsSchema.parse(batch.defaults);
      const seen = new Set<string>();
      const warnings = new Map<string, number>();
      let chunk: Prisma.ImportRowCreateManyInput[] = [];
      let total = 0;
      let valid = 0;
      const stream = await this.storage.read(batch.storageKey);
      for await (const item of readTable(stream, formatOf(batch.fileName) ?? ImportFormat.Csv)) {
        if (!('values' in item)) continue;
        total += 1;
        if (total > MAX_IMPORT_ROWS) throw new Error(`the file has more than ${MAX_IMPORT_ROWS} rows; split it into smaller files`);
        const mapped = await handler.mapRow(item.values, mapping, defaults);
        const rowWarnings = [...mapped.warnings];
        if (mapped.dedupeKey) {
          if (seen.has(mapped.dedupeKey)) rowWarnings.push(ImportWarning.DuplicateInFile);
          seen.add(mapped.dedupeKey);
        }
        for (const warning of rowWarnings) warnings.set(warning, (warnings.get(warning) ?? 0) + 1);
        const ok = mapped.errors.length === 0 && mapped.input !== null;
        if (ok) valid += 1;
        chunk.push({
          batchId: batch.id,
          rowNumber: item.rowNumber,
          status: ok ? ImportRowStatus.valid : ImportRowStatus.invalid,
          rawEnc: this.cipher.encryptJson(item.values, CipherPurpose.ImportRow),
          errors: { errors: mapped.errors, warnings: rowWarnings },
        });
        if (chunk.length >= IMPORT_ROW_CHUNK) {
          await this.imports.createRows(chunk);
          await this.imports.updateProgress(batch.id, { totalRows: total, validRows: valid, invalidRows: total - valid });
          chunk = [];
        }
      }
      if (chunk.length > 0) await this.imports.createRows(chunk);
      await this.finish(batch, ImportBatchEvent.FinishValidation, { totalRows: total, validRows: valid, invalidRows: total - valid, summary: { warnings: Object.fromEntries(warnings) } });
      await this.changes.record({ action: AuditAction.ImportValidated, entityType: AuditEntity.ImportBatch, entityId: batch.id, event: EventName.ImportValidated, metadata: { total, valid }, payload: { batchId: batch.id, total, valid } });
    } catch (error) {
      this.logger.warn({ err: error, batchId: batch.id }, 'Import validation failed');
      await this.finish(batch, ImportBatchEvent.Fail, { error: error instanceof Error ? error.message : 'validation failed' });
    }
  }

  private async commit(batch: ImportBatch, handler: ImportHandler) {
    const mapping = batch.mapping as Record<string, string>;
    const defaults = handler.defaultsSchema.parse(batch.defaults);
    let after = 0;
    for (;;) {
      const rows = await this.imports.rowsAfter(batch.id, ImportRowStatus.valid, after, IMPORT_ROW_CHUNK);
      if (rows.length === 0) break;
      for (const row of rows) {
        after = row.rowNumber;
        const values = this.cipher.decryptJson<Values>(row.rawEnc, CipherPurpose.ImportRow);
        const mapped = await handler.mapRow(values, mapping, defaults);
        if (!mapped.input || mapped.errors.length > 0) {
          await this.imports.updateRow(row.id, { status: ImportRowStatus.failed, errors: { errors: mapped.errors, warnings: mapped.warnings } });
          continue;
        }
        try {
          const result = await handler.commitRow(mapped.input, { batchId: batch.id, rowNumber: row.rowNumber, defaults, actorUserId: batch.createdByUserId });
          await this.imports.updateRow(row.id, { status: ImportRowStatus.committed, entityId: result.entityId });
        } catch (error) {
          if (!(error instanceof AppError)) throw error;
          await this.imports.updateRow(row.id, { status: ImportRowStatus.failed, errors: { errors: [{ field: 'row', column: null, code: error.code, message: error.message }], details: error.details ?? null } });
        }
      }
      await this.imports.updateProgress(batch.id, await this.counts(batch.id));
    }
    const counts = await this.counts(batch.id);
    await this.finish(batch, ImportBatchEvent.FinishCommit, counts);
    await this.changes.record({ action: AuditAction.ImportCommitted, entityType: AuditEntity.ImportBatch, entityId: batch.id, event: EventName.ImportCommitted, metadata: counts, payload: { batchId: batch.id, ...counts } });
  }

  private async undo(batch: ImportBatch, handler: ImportHandler) {
    const defaults = handler.defaultsSchema.parse(batch.defaults);
    let after = 0;
    for (;;) {
      const rows = await this.imports.rowsAfter(batch.id, ImportRowStatus.committed, after, IMPORT_ROW_CHUNK);
      if (rows.length === 0) break;
      for (const row of rows) {
        after = row.rowNumber;
        const undone = row.entityId ? await handler.undoRow(row.entityId, { batchId: batch.id, rowNumber: row.rowNumber, defaults, actorUserId: batch.createdByUserId }) : false;
        await this.imports.updateRow(row.id, { status: undone ? ImportRowStatus.undone : ImportRowStatus.kept });
      }
    }
    const counts = await this.counts(batch.id);
    await this.finish(batch, ImportBatchEvent.FinishUndo, counts);
    await this.changes.record({ action: AuditAction.ImportUndone, entityType: AuditEntity.ImportBatch, entityId: batch.id, event: EventName.ImportUndone, metadata: counts, payload: { batchId: batch.id, ...counts } });
  }

  private async counts(batchId: string) {
    const grouped = new Map((await this.imports.countByStatus(batchId)).map((group) => [group.status, group._count.status]));
    const count = (status: ImportRowStatus) => grouped.get(status) ?? 0;
    return { committedRows: count(ImportRowStatus.committed) + count(ImportRowStatus.undone) + count(ImportRowStatus.kept), failedRows: count(ImportRowStatus.failed), undoneRows: count(ImportRowStatus.undone) };
  }

  private async sample(batch: ImportBatch, format: ImportFormat) {
    let headers: string[] = [];
    const rows: Values[] = [];
    const stream = await this.storage.read(batch.storageKey);
    for await (const item of readTable(stream, format)) {
      if ('headers' in item) headers = item.headers;
      else rows.push(item.values);
      if (rows.length >= IMPORT_SAMPLE_ROWS) break;
    }
    stream.destroy();
    return { headers, rows };
  }

  private async finish(batch: ImportBatch, event: ImportBatchEvent, data: Prisma.ImportBatchUncheckedUpdateManyInput) {
    const current = await this.require(batch.id);
    const next = transitionOrThrow(importBatchMachine, current.status, event);
    await this.imports.updateFromStatus(batch.id, current.status, { ...data, status: next, finishedAt: new Date() });
  }

  private async move(batch: ImportBatch, next: ImportStatus, data: Prisma.ImportBatchUncheckedUpdateManyInput) {
    const result = await this.imports.updateFromStatus(batch.id, batch.status, { ...data, status: next });
    if (result.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT);
  }

  private invalid(path: string, code: string, message: string) {
    return new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path, code, message }] });
  }

  private async require(id: string) {
    const batch = await this.imports.find(id);
    if (!batch) throw new AppError(ErrorCode.NOT_FOUND);
    return batch;
  }
}
