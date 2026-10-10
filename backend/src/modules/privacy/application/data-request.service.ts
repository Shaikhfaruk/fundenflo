import { accessibleBy } from '@casl/prisma/runtime';
import { Transactional } from '@nestjs-cls/transactional';
import { Injectable, Logger } from '@nestjs/common';

import { DAY_MS } from '../../../common/constants/time.constants.js';
import type { UserActor } from '../../../common/context/actor.js';
import { DataRequestKind, DataRequestStatus } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { transitionOrThrow } from '../../../common/errors/transition.js';
import { EventName } from '../../../common/events/event-names.js';
import { type PageQuery, pageWindow, toPage } from '../../../common/listing/cursor-page.js';
import { DataRequestEvent, dataRequestMachine, OPEN_DATA_REQUEST_STATES } from '../../../engines/state-machines/machines/data-request.machine.js';
import type { DataSubjectRequest, Prisma } from '../../../generated/prisma/client.js';
import { RefGenerator, RefKind } from '../../../infrastructure/database/ref-generator.js';
import { InjectObjectStorage, type ObjectStorage } from '../../../infrastructure/storage/storage.port.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { AuditService } from '../../audit/application/audit.service.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { MeService } from '../../auth/application/me.service.js';
import { DATA_EXPORT_CONTENT_TYPE, DATA_EXPORT_FORMAT, DATA_EXPORT_KEY_PREFIX, DATA_EXPORT_READ_URL_TTL_SECONDS, DATA_EXPORT_TTL_DAYS, DATA_REQUEST_DUE_DAYS, DATA_REQUESTS_LIMIT } from '../domain/privacy.constants.js';
import type { PrivacySubject } from '../domain/privacy-participant.types.js';
import { DataRequestRepository } from '../infrastructure/data-request.repository.js';
import { PrivacyParticipantRegistry } from './privacy-participant.registry.js';

export type DataRequestInput = { kind: DataRequestKind; details?: string };

export type DataRequestFilters = { status?: DataRequestStatus; kind?: DataRequestKind };

const iso = (value: Date | null) => value?.toISOString() ?? null;

const later = (days: number) => new Date(Date.now() + days * DAY_MS);

const toView = (request: DataSubjectRequest, staff: boolean) => ({
  id: request.id,
  ref: request.ref,
  kind: request.kind,
  status: request.status,
  details: request.details,
  dueAt: request.dueAt.toISOString(),
  response: request.response,
  rejectedReason: request.rejectedReason,
  exportReady: request.exportStorageKey !== null,
  exportExpiresAt: iso(request.exportExpiresAt),
  completedAt: iso(request.completedAt),
  ...(staff ? { userId: request.userId, partyId: request.partyId, outcome: request.outcome, handledByUserId: request.handledByUserId } : {}),
  version: request.version,
  createdAt: request.createdAt.toISOString(),
});

@Injectable()
export class DataRequestService {
  private readonly logger = new Logger(DataRequestService.name);

  constructor(
    private readonly requests: DataRequestRepository,
    private readonly participants: PrivacyParticipantRegistry,
    private readonly me: MeService,
    private readonly refs: RefGenerator,
    private readonly audit: AuditService,
    private readonly changes: ChangeRecorder,
    @InjectObjectStorage() private readonly storage: ObjectStorage,
  ) {}

  @Transactional()
  async create(actor: UserActor, input: DataRequestInput) {
    const partyId = await this.me.partyIdOf(actor.userId);
    if (await this.requests.findOne({ userId: actor.userId, kind: input.kind, status: { in: [...OPEN_DATA_REQUEST_STATES] } })) throw new AppError(ErrorCode.CONFLICT, { details: { kind: input.kind } });
    if (input.kind === DataRequestKind.correction && !input.details) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'details', code: 'required', message: 'say what should be corrected' }] });
    const request = await this.requests.create({ ref: await this.refs.next(RefKind.DataRequest), userId: actor.userId, partyId, kind: input.kind, details: input.details ?? null, dueAt: later(DATA_REQUEST_DUE_DAYS) });
    await this.changes.record({ action: AuditAction.DataRequestReceived, entityType: AuditEntity.DataSubjectRequest, entityId: request.id, event: EventName.DataRequestReceived, metadata: { ref: request.ref, kind: request.kind }, payload: { dataRequestId: request.id, kind: request.kind, userId: actor.userId } });
    return toView(request, false);
  }

  async mine(actor: UserActor) {
    return { items: (await this.requests.list({ userId: actor.userId }, DATA_REQUESTS_LIMIT)).map((request) => toView(request, false)) };
  }

  async exportUrl(actor: UserActor, id: string) {
    const request = await this.requests.findOne({ id, userId: actor.userId });
    if (!request) throw new AppError(ErrorCode.NOT_FOUND);
    if (!request.exportStorageKey || !request.exportExpiresAt || request.exportExpiresAt < new Date()) throw new AppError(ErrorCode.NOT_FOUND, { details: { reason: 'no_export' } });
    const url = await this.storage.createReadUrl(request.exportStorageKey, { ttlSeconds: DATA_EXPORT_READ_URL_TTL_SECONDS, downloadName: `${request.ref}.json`, contentType: DATA_EXPORT_CONTENT_TYPE });
    await this.audit.record({ action: AuditAction.DataExportDownloaded, entityType: AuditEntity.DataSubjectRequest, entityId: id, metadata: { ref: request.ref } });
    return { url, expiresAt: new Date(Date.now() + DATA_EXPORT_READ_URL_TTL_SECONDS * 1000).toISOString() };
  }

  async list(ability: AppAbility, query: PageQuery & DataRequestFilters) {
    const window = pageWindow(query);
    const rows = await this.requests.list({ AND: [accessibleBy(ability, AppAction.Read).ofType('DataSubjectRequest'), { id: window.idFilter, status: query.status, kind: query.kind }] }, window.take);
    return toPage(rows, query.limit, (row) => toView(row, true));
  }

  async get(id: string, ability: AppAbility) {
    const request = await this.visible(id, ability, AppAction.Read);
    const holds = request.kind === DataRequestKind.erasure && OPEN_DATA_REQUEST_STATES.includes(request.status) ? await this.holdsOf(await this.subjectOf(request)) : [];
    return { ...toView(request, true), holds };
  }

  async buildExport(id: string) {
    const request = await this.requests.findOne({ id });
    if (request?.kind !== DataRequestKind.access || request.status !== DataRequestStatus.received) return null;
    const key = await this.writeExport(request);
    await this.finish(request, { exportStorageKey: key, exportExpiresAt: later(DATA_EXPORT_TTL_DAYS), response: `Your data export ${request.ref} is ready to download for ${DATA_EXPORT_TTL_DAYS} days.` }, null);
    return key;
  }

  @Transactional()
  async complete(id: string, input: { response: string }, actor: UserActor, ability: AppAbility) {
    await this.requests.lock(id);
    const request = await this.visible(id, ability, AppAction.Update);
    transitionOrThrow(dataRequestMachine, request.status, DataRequestEvent.Complete);
    if (request.kind === DataRequestKind.access) {
      const key = await this.writeExport(request);
      await this.finish(request, { exportStorageKey: key, exportExpiresAt: later(DATA_EXPORT_TTL_DAYS), response: input.response }, actor.userId);
    } else if (request.kind === DataRequestKind.erasure) {
      const subject = await this.subjectOf(request);
      const holds = await this.holdsOf(subject);
      if (holds.length > 0) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: holds.map((hold) => ({ path: 'holds', code: 'legal_hold', message: hold })) });
      const outcome: Record<string, Record<string, number>> = {};
      for (const [section, participant] of this.participants.ordered()) if (participant.erase) outcome[section] = await participant.erase(subject);
      await this.audit.record({ action: AuditAction.PersonalDataErased, entityType: AuditEntity.DataSubjectRequest, entityId: id, metadata: { ref: request.ref, partyIds: subject.partyIds, outcome } });
      await this.finish(request, { response: input.response, outcome }, actor.userId);
    } else {
      await this.finish(request, { response: input.response }, actor.userId);
    }
    return this.get(id, ability);
  }

  @Transactional()
  async reject(id: string, reason: string, actor: UserActor, ability: AppAbility) {
    await this.requests.lock(id);
    const request = await this.visible(id, ability, AppAction.Update);
    const next = transitionOrThrow(dataRequestMachine, request.status, DataRequestEvent.Reject);
    const moved = await this.requests.updateFromStatus(id, request.status, { status: next, rejectedReason: reason, handledByUserId: actor.userId });
    if (moved.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT);
    await this.changes.record({ action: AuditAction.DataRequestRejected, entityType: AuditEntity.DataSubjectRequest, entityId: id, event: EventName.DataRequestRejected, metadata: { ref: request.ref, reason }, payload: { dataRequestId: id, userId: request.userId } });
    return this.get(id, ability);
  }

  async dropExpiredExports(now: Date, take: number) {
    let removed = 0;
    for (const row of await this.requests.expiredExports(now, take)) {
      try {
        if (row.exportStorageKey) await this.storage.delete(row.exportStorageKey);
        await this.requests.clearExport(row.id);
        removed += 1;
      } catch (error) {
        this.logger.warn({ err: error, dataRequestId: row.id }, 'Data export was not removed; the next run retries');
      }
    }
    return removed;
  }

  private async finish(request: DataSubjectRequest, data: Prisma.DataSubjectRequestUncheckedUpdateManyInput, handledByUserId: string | null) {
    const next = transitionOrThrow(dataRequestMachine, request.status, DataRequestEvent.Complete);
    const moved = await this.requests.updateFromStatus(request.id, request.status, { ...data, status: next, completedAt: new Date(), handledByUserId });
    if (moved.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT);
    await this.changes.record({ action: AuditAction.DataRequestCompleted, entityType: AuditEntity.DataSubjectRequest, entityId: request.id, event: EventName.DataRequestCompleted, metadata: { ref: request.ref, kind: request.kind }, payload: { dataRequestId: request.id, kind: request.kind, userId: request.userId } });
  }

  private async writeExport(request: DataSubjectRequest) {
    const subject = await this.subjectOf(request);
    const sections: Record<string, unknown> = {};
    for (const [section, participant] of this.participants.ordered()) if (participant.export) sections[section] = await participant.export(subject);
    const key = `${DATA_EXPORT_KEY_PREFIX}/${request.id}.json`;
    await this.storage.put({ key, body: Buffer.from(JSON.stringify({ format: DATA_EXPORT_FORMAT, ref: request.ref, generatedAt: new Date().toISOString(), sections }, null, 2)), contentType: DATA_EXPORT_CONTENT_TYPE });
    return key;
  }

  private async subjectOf(request: DataSubjectRequest): Promise<PrivacySubject> {
    const related: string[] = [];
    for (const [, participant] of this.participants.ordered()) if (participant.relatedParties) related.push(...(await participant.relatedParties(request.partyId)));
    return { userId: request.userId, personPartyId: request.partyId, partyIds: [...new Set([request.partyId, ...related])], requestRef: request.ref };
  }

  private async holdsOf(subject: PrivacySubject) {
    const holds: string[] = [];
    for (const [, participant] of this.participants.ordered()) if (participant.holds) holds.push(...(await participant.holds(subject)));
    return [...new Set(holds)];
  }

  private async visible(id: string, ability: AppAbility, action: AppAction) {
    const request = await this.requests.findOne({ AND: [accessibleBy(ability, action).ofType('DataSubjectRequest'), { id }] });
    if (!request) throw new AppError(ErrorCode.NOT_FOUND);
    return request;
  }
}
