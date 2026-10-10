import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { UserActor } from '../../../common/context/actor.js';
import { type CatalogStatus, type ChangeRequestStatus, ChangeRequestStatus as RequestStatus, ConfigResource, ConfigVersionStatus } from '../../../common/enums/db.enums.js';
import { EventName } from '../../../common/events/event-names.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { transitionOrThrow } from '../../../common/errors/transition.js';
import { assertVersion } from '../../../common/http/versioning.js';
import type { LocalisedText } from '../../../common/i18n/locale.js';
import { type PageQuery, pageWindow, toPage } from '../../../common/listing/cursor-page.js';
import { uuidv7 } from '../../../common/ids/uuid-v7.js';
import { diffJson } from '../../../common/utils/json-diff.js';
import { stableStringify } from '../../../common/utils/stable-json.js';
import { parseOrThrow } from '../../../common/validation/zod-validation.pipe.js';
import { ConfigVersionEvent, configVersionMachine, OPEN_CONFIG_VERSION_STATES } from '../../../engines/state-machines/machines/config-version.machine.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { runThenInvalidate } from '../../../infrastructure/cache/run-then-invalidate.js';
import { sha256 } from '../../../infrastructure/crypto/secure-random.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';
import { AppAction, type AppAbility } from '../../access/domain/ability.types.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { pickActiveVersion } from '../domain/active-version.js';
import { CONFIG_CACHE_TTL_SECONDS, configCacheTag, MAX_CONFIG_CONTENT_BYTES, PUBLISH_BACKDATE_TOLERANCE_MS } from '../domain/config.constants.js';
import type { ConfigIssue, ConfigResourceHandler, PublishedConfig } from '../domain/config.types.js';
import { ConfigRepository } from '../infrastructure/config.repository.js';
import { ConfigHandlerRegistry } from './config-handler.registry.js';
import { configSubject } from './config-subject.js';
import { toChangeRequestView, toConfigDocumentView, toConfigVersionView } from './config.views.js';

export type ConfigDocumentInput = { key: string; name: LocalisedText; description?: LocalisedText; content: unknown; notes?: string };
export type ConfigDocumentPatch = { name?: LocalisedText; description?: LocalisedText | null; status?: CatalogStatus };
export type ConfigVersionInput = { fromNumber?: number; content?: unknown; notes?: string };
export type ConfigDraftPatch = { content?: unknown; notes?: string | null };

type CachedPublished = { documentId: string; key: string; versionId: string; number: number; effectiveFrom: string | null; compiled: unknown };

const json = (value: unknown) => value as Prisma.InputJsonValue;

@Injectable()
export class ConfigPublishingService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTx>,
    private readonly repo: ConfigRepository,
    private readonly registry: ConfigHandlerRegistry,
    private readonly cache: CacheService,
    private readonly changes: ChangeRecorder,
  ) {}

  async listDocuments(resource: ConfigResource, query: PageQuery & { status?: CatalogStatus }) {
    const window = pageWindow(query);
    const rows = await this.repo.listDocuments(resource, query.status, window.take, window.idFilter);
    const now = new Date();
    return toPage(rows, query.limit, (row) => toConfigDocumentView(row, now));
  }

  async getDocument(resource: ConfigResource, id: string) {
    return toConfigDocumentView(await this.requireDocument(resource, id), new Date());
  }

  createDocument(resource: ConfigResource, input: ConfigDocumentInput, actor: UserActor) {
    const handler = this.registry.get(resource);
    const content = this.parseContent(handler, input.content);
    return this.txHost.withTransaction(async () => {
      const document = await this.repo.createDocument({
        resource,
        key: input.key,
        name: input.name,
        description: input.description ?? Prisma.DbNull,
        createdByUserId: actor.userId,
      });
      const draft = await this.openDraft(document, handler, content, input.notes, actor);
      await this.changes.record({
        action: AuditAction.ConfigCreated,
        entityType: AuditEntity.ConfigDocument,
        entityId: document.id,
        event: EventName.ConfigChanged,
        metadata: { resource, key: document.key, versionId: draft.id },
        payload: { resource, key: document.key },
      });
      return this.getDocument(resource, document.id);
    });
  }

  updateDocument(resource: ConfigResource, id: string, patch: ConfigDocumentPatch, expectedVersion: number | undefined) {
    return runThenInvalidate(this.txHost, this.cache, [configCacheTag(resource)], async () => {
      const document = await this.requireDocument(resource, id);
      assertVersion(expectedVersion, document.version);
      const result = await this.repo.updateDocumentVersioned(id, document.version, {
        ...patch,
        description: patch.description === null ? Prisma.DbNull : patch.description,
      });
      if (result.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT, { details: { currentVersion: document.version + 1 } });
      await this.changes.record({
        action: AuditAction.ConfigChanged,
        entityType: AuditEntity.ConfigDocument,
        entityId: id,
        event: EventName.ConfigChanged,
        metadata: { resource, fields: Object.keys(patch) },
        payload: { resource, key: document.key },
      });
      return this.getDocument(resource, id);
    });
  }

  createVersion(resource: ConfigResource, id: string, input: ConfigVersionInput, actor: UserActor) {
    const handler = this.registry.get(resource);
    const given = input.content === undefined ? undefined : this.parseContent(handler, input.content);
    return this.txHost.withTransaction(async () => {
      const document = await this.requireDocument(resource, id);
      const content = given ?? (await this.sourceContent(document.id, input.fromNumber));
      const draft = await this.openDraft(document, handler, content, input.notes, actor);
      await this.changes.record({
        action: AuditAction.ConfigVersionCreated,
        entityType: AuditEntity.ConfigVersion,
        entityId: draft.id,
        event: EventName.ConfigChanged,
        metadata: { resource, key: document.key, number: draft.number, fromNumber: input.fromNumber ?? null },
        payload: { resource, key: document.key, number: draft.number },
      });
      return this.getVersion(resource, id, draft.number);
    });
  }

  async getVersion(resource: ConfigResource, id: string, number: number) {
    return toConfigVersionView(await this.requireVersion(resource, id, number));
  }

  updateDraft(resource: ConfigResource, id: string, number: number, patch: ConfigDraftPatch, expectedVersion: number | undefined) {
    const handler = this.registry.get(resource);
    const given = patch.content === undefined ? undefined : this.parseContent(handler, patch.content);
    return this.txHost.withTransaction(async () => {
      const version = await this.requireVersion(resource, id, number);
      this.transition(version.status, ConfigVersionEvent.Edit);
      assertVersion(expectedVersion, version.version);
      const content = given ?? version.content;
      const { issues } = await handler.compile(content, { documentKey: version.document.key });
      const result = await this.repo.updateVersionGuarded(
        version.id,
        { status: ConfigVersionStatus.draft, version: version.version },
        { content: json(content), issues: json(issues), notes: patch.notes === undefined ? undefined : patch.notes },
      );
      if (result.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT, { details: { currentVersion: version.version + 1 } });
      await this.changes.record({
        action: AuditAction.ConfigChanged,
        entityType: AuditEntity.ConfigVersion,
        entityId: version.id,
        event: EventName.ConfigChanged,
        metadata: { resource, key: version.document.key, number, fields: Object.keys(patch), issues: issues.length },
        payload: { resource, key: version.document.key, number },
      });
      return this.getVersion(resource, id, number);
    });
  }

  submit(resource: ConfigResource, id: string, number: number, reason: string, expectedVersion: number | undefined, actor: UserActor) {
    const handler = this.registry.get(resource);
    return this.txHost.withTransaction(async () => {
      const version = await this.requireVersion(resource, id, number);
      const next = this.transition(version.status, ConfigVersionEvent.Submit);
      assertVersion(expectedVersion, version.version);
      const { compiled, issues } = await handler.compile(version.content, { documentKey: version.document.key });
      if (issues.length > 0 || compiled === null) throw this.invalid(issues);
      const previous = await this.repo.latestVersionWith(version.documentId, [ConfigVersionStatus.published]);
      const diff = diffJson(previous?.compiled ?? null, compiled);
      if (previous && diff.changes.length === 0) {
        throw this.invalid([{ path: 'content', code: 'no_changes', message: `version ${number} is identical to published version ${previous.number}` }]);
      }
      const result = await this.repo.updateVersionGuarded(
        version.id,
        { status: ConfigVersionStatus.draft, version: version.version },
        { status: next, compiled: json(compiled), issues: json([]), contentHash: sha256(stableStringify(compiled)), submittedByUserId: actor.userId },
      );
      if (result.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT, { details: { currentVersion: version.version + 1 } });
      const request = await this.repo.createChangeRequest({
        versionId: version.id,
        resource,
        makerUserId: actor.userId,
        reason,
        diff: json({ ...diff, comparedWith: previous ? { versionId: previous.id, number: previous.number } : null }),
      });
      await this.changes.record({
        action: AuditAction.ConfigSubmitted,
        entityType: AuditEntity.ConfigChangeRequest,
        entityId: request.id,
        event: EventName.ConfigChangeRequested,
        metadata: { resource, key: version.document.key, number, changes: diff.changes.length },
        payload: { resource, key: version.document.key, documentId: version.documentId, versionId: version.id, number, changeRequestId: request.id },
      });
      return this.getVersion(resource, id, number);
    });
  }

  approve(changeRequestId: string, note: string | undefined, actor: UserActor, ability: AppAbility) {
    return this.decide(changeRequestId, RequestStatus.approved, note, actor, ability);
  }

  reject(changeRequestId: string, note: string, actor: UserActor, ability: AppAbility) {
    return this.decide(changeRequestId, RequestStatus.rejected, note, actor, ability);
  }

  publish(resource: ConfigResource, id: string, number: number, effectiveFrom: Date | undefined, actor: UserActor) {
    const handler = this.registry.get(resource);
    return runThenInvalidate(this.txHost, this.cache, [configCacheTag(resource)], async () => {
      const version = await this.requireVersion(resource, id, number);
      const next = this.transition(version.status, ConfigVersionEvent.Publish);
      const now = new Date();
      const startsAt = this.effectiveFrom(effectiveFrom, now);
      const result = await this.repo.updateVersionGuarded(
        version.id,
        { status: ConfigVersionStatus.approved },
        { status: next, publishedAt: now, effectiveFrom: startsAt, publishedByUserId: actor.userId },
      );
      if (result.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT, { details: { currentVersion: version.version + 1 } });
      await this.repo.releaseOpenVersion(version.documentId, version.id);
      await handler.onPublished?.({ documentId: version.documentId, key: version.document.key, versionId: version.id, number, effectiveFrom: startsAt, compiled: version.compiled });
      await this.changes.record({
        action: AuditAction.ConfigPublished,
        entityType: AuditEntity.ConfigVersion,
        entityId: version.id,
        event: EventName.ConfigPublished,
        metadata: { resource, key: version.document.key, number, effectiveFrom: startsAt.toISOString(), contentHash: version.contentHash },
        payload: { resource, key: version.document.key, documentId: version.documentId, versionId: version.id, number, effectiveFrom: startsAt.toISOString() },
      });
      return this.getVersion(resource, id, number);
    });
  }

  retire(resource: ConfigResource, id: string, number: number, reason: string, actor: UserActor) {
    return runThenInvalidate(this.txHost, this.cache, [configCacheTag(resource)], async () => {
      const version = await this.requireVersion(resource, id, number);
      const next = this.transition(version.status, ConfigVersionEvent.Retire);
      const result = await this.repo.updateVersionGuarded(version.id, { status: version.status }, { status: next, retiredAt: new Date(), retiredByUserId: actor.userId });
      if (result.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT, { details: { currentVersion: version.version + 1 } });
      await this.repo.releaseOpenVersion(version.documentId, version.id);
      const withdrawn = await this.repo.withdrawPendingChangeRequests(version.id);
      await this.changes.record({
        action: AuditAction.ConfigRetired,
        entityType: AuditEntity.ConfigVersion,
        entityId: version.id,
        event: EventName.ConfigRetired,
        metadata: { resource, key: version.document.key, number, previousStatus: version.status, reason, withdrawnRequests: withdrawn.count },
        payload: { resource, key: version.document.key, documentId: version.documentId, versionId: version.id, number },
      });
      return this.getVersion(resource, id, number);
    });
  }

  async listChangeRequests(query: PageQuery & { status?: ChangeRequestStatus; resource?: ConfigResource }, ability: AppAbility) {
    const resources = this.readableResources(ability).filter((resource) => !query.resource || resource === query.resource);
    const window = pageWindow(query);
    const rows = resources.length === 0 ? [] : await this.repo.listChangeRequests({ status: query.status, resources }, window.take, window.idFilter);
    return toPage(rows, query.limit, toChangeRequestView);
  }

  async getChangeRequest(id: string, ability: AppAbility) {
    const request = await this.repo.findChangeRequest(id);
    if (!request || !ability.can(AppAction.Read, configSubject(request.resource))) throw new AppError(ErrorCode.NOT_FOUND);
    return toChangeRequestView(request);
  }

  async active<TCompiled>(resource: ConfigResource, now = new Date()): Promise<Array<PublishedConfig<TCompiled>>> {
    const published = await this.cache.wrap<CachedPublished[]>(`config:active:${resource}`, [configCacheTag(resource)], CONFIG_CACHE_TTL_SECONDS, async () =>
      (await this.repo.listPublished(resource)).map((row) => ({
        documentId: row.documentId,
        key: row.document.key,
        versionId: row.id,
        number: row.number,
        effectiveFrom: row.effectiveFrom?.toISOString() ?? null,
        compiled: row.compiled,
      })),
    );
    const byDocument = Map.groupBy(
      published.map((row) => ({ ...row, status: ConfigVersionStatus.published, effectiveFrom: row.effectiveFrom ? new Date(row.effectiveFrom) : null })),
      (row) => row.documentId,
    );
    return [...byDocument.values()].flatMap((versions) => {
      const chosen = pickActiveVersion(versions, now);
      return chosen?.effectiveFrom
        ? [{ documentId: chosen.documentId, key: chosen.key, versionId: chosen.versionId, number: chosen.number, effectiveFrom: chosen.effectiveFrom, compiled: chosen.compiled as TCompiled }]
        : [];
    });
  }

  async pinnedVersion<TCompiled>(resource: ConfigResource, versionId: string): Promise<PublishedConfig<TCompiled> | null> {
    const version = await this.repo.findVersionById(versionId);
    if (version?.document.resource !== resource || version.compiled === null || !version.effectiveFrom) return null;
    return { documentId: version.documentId, key: version.document.key, versionId: version.id, number: version.number, effectiveFrom: version.effectiveFrom, compiled: version.compiled as TCompiled };
  }

  private decide(changeRequestId: string, status: typeof RequestStatus.approved | typeof RequestStatus.rejected, note: string | undefined, actor: UserActor, ability: AppAbility) {
    return this.txHost.withTransaction(async () => {
      const request = await this.repo.findChangeRequest(changeRequestId);
      if (!request || !ability.can(AppAction.Read, configSubject(request.resource))) throw new AppError(ErrorCode.NOT_FOUND);
      if (!ability.can(AppAction.Approve, configSubject(request.resource))) throw new AppError(ErrorCode.FORBIDDEN);
      if (request.status !== RequestStatus.pending) throw new AppError(ErrorCode.INVALID_TRANSITION, { details: { from: request.status, event: status } });
      if (request.makerUserId === actor.userId) throw new AppError(ErrorCode.SELF_APPROVAL_NOT_ALLOWED);
      const event = status === RequestStatus.approved ? ConfigVersionEvent.Approve : ConfigVersionEvent.Reject;
      const next = this.transition(request.configVersion.status, event);
      const decided = await this.repo.decideChangeRequest(request.id, { status, checkerUserId: actor.userId, decisionNote: note ?? null, decidedAt: new Date() });
      if (decided.count === 0) throw new AppError(ErrorCode.INVALID_TRANSITION, { details: { from: request.status, event: status } });
      const moved = await this.repo.updateVersionGuarded(
        request.versionId,
        { status: ConfigVersionStatus.in_review },
        status === RequestStatus.approved ? { status: next, approvedByUserId: actor.userId } : { status: next },
      );
      if (moved.count === 0) throw new AppError(ErrorCode.INVALID_TRANSITION, { details: { from: request.configVersion.status, event } });
      const document = request.configVersion.document;
      await this.changes.record({
        action: status === RequestStatus.approved ? AuditAction.ConfigApproved : AuditAction.ConfigRejected,
        entityType: AuditEntity.ConfigChangeRequest,
        entityId: request.id,
        event: EventName.ConfigChangeDecided,
        metadata: { resource: request.resource, key: document.key, number: request.configVersion.number, note: note ?? null },
        payload: { resource: request.resource, key: document.key, documentId: document.id, versionId: request.versionId, decision: status, makerUserId: request.makerUserId },
      });
      const updated = await this.repo.findChangeRequest(request.id);
      if (!updated) throw new AppError(ErrorCode.NOT_FOUND);
      return toChangeRequestView(updated);
    });
  }

  private async openDraft(document: { id: string; key: string }, handler: ConfigResourceHandler, content: unknown, notes: string | undefined, actor: UserActor) {
    const id = uuidv7();
    const number = await this.repo.claimOpenVersion(document.id, id);
    if (number === null) throw new AppError(ErrorCode.OPEN_VERSION_EXISTS);
    const { issues } = await handler.compile(content, { documentKey: document.key });
    return this.repo.createVersion({ id, documentId: document.id, number, content: json(content), issues: json(issues), notes: notes ?? null, createdByUserId: actor.userId });
  }

  private async sourceContent(documentId: string, fromNumber: number | undefined): Promise<unknown> {
    if (fromNumber !== undefined) {
      const source = await this.repo.findVersion(documentId, fromNumber);
      if (!source) throw new AppError(ErrorCode.NOT_FOUND, { details: { fromNumber } });
      return source.content;
    }
    const source =
      (await this.repo.latestVersionWith(documentId, [ConfigVersionStatus.published])) ??
      (await this.repo.latestVersionWith(documentId, [...OPEN_CONFIG_VERSION_STATES, ConfigVersionStatus.retired]));
    if (!source) throw this.invalid([{ path: 'content', code: 'required', message: 'content is required when there is no earlier version to copy' }]);
    return source.content;
  }

  private parseContent(handler: ConfigResourceHandler, content: unknown): unknown {
    if (Buffer.byteLength(JSON.stringify(content ?? null), 'utf8') > MAX_CONFIG_CONTENT_BYTES) {
      throw this.invalid([{ path: 'content', code: 'too_big', message: `content must be at most ${MAX_CONFIG_CONTENT_BYTES} bytes` }]);
    }
    return parseOrThrow(handler.contentSchema, content, 'content');
  }

  private effectiveFrom(requested: Date | undefined, now: Date): Date {
    if (!requested) return now;
    if (requested.getTime() < now.getTime() - PUBLISH_BACKDATE_TOLERANCE_MS) {
      throw this.invalid([{ path: 'effectiveFrom', code: 'in_past', message: 'effectiveFrom cannot be in the past' }]);
    }
    return requested < now ? now : requested;
  }

  private transition(state: ConfigVersionStatus, event: ConfigVersionEvent): ConfigVersionStatus {
    return transitionOrThrow(configVersionMachine, state, event);
  }

  private invalid(issues: ConfigIssue[]) {
    return new AppError(ErrorCode.VALIDATION_FAILED, { details: issues });
  }

  private readableResources(ability: AppAbility): ConfigResource[] {
    return Object.values(ConfigResource).filter((resource) => ability.can(AppAction.Read, configSubject(resource)));
  }

  private async requireDocument(resource: ConfigResource, id: string) {
    const document = await this.repo.findDocument(resource, id);
    if (!document) throw new AppError(ErrorCode.NOT_FOUND);
    return document;
  }

  private async requireVersion(resource: ConfigResource, id: string, number: number) {
    const version = await this.repo.findVersion(id, number);
    if (version?.document.resource !== resource) throw new AppError(ErrorCode.NOT_FOUND);
    return version;
  }
}
