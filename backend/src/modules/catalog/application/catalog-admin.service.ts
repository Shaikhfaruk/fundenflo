import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { CatalogStatus } from '../../../common/enums/db.enums.js';
import { EventName } from '../../../common/events/event-names.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { assertVersion } from '../../../common/http/versioning.js';
import type { LocalisedText } from '../../../common/i18n/locale.js';
import { paiseFromNumber, paiseToNumber } from '../../../common/money/paise.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';
import { OutboxService } from '../../../infrastructure/outbox/outbox.service.js';
import { AuditService } from '../../audit/application/audit.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { CatalogCacheTag } from '../domain/catalog.constants.js';
import { CatalogRepository } from '../infrastructure/catalog.repository.js';
import { toCategoryAdminView, toPurposeAdminView, toSegmentAdminView, toSubSegmentAdminView } from './catalog.views.js';

export type SegmentInput = { key: string; label: LocalisedText; description?: LocalisedText; icon?: string; sortOrder?: number };
export type SegmentPatch = { label?: LocalisedText; description?: LocalisedText | null; icon?: string | null; sortOrder?: number; status?: CatalogStatus };
export type SubSegmentInput = { key: string; label: LocalisedText; sortOrder?: number };
export type SubSegmentPatch = { label?: LocalisedText; sortOrder?: number; status?: CatalogStatus };
export type PurposeInput = { key: string; label: LocalisedText; requiresNote?: boolean; sortOrder?: number };
export type PurposePatch = { label?: LocalisedText; requiresNote?: boolean; sortOrder?: number; status?: CatalogStatus };
export type CategoryLimits = {
  minAmountPaise: number;
  maxAmountPaise: number;
  stepPaise: number;
  defaultAmountPaise: number;
  tenureOptionsMonths: number[];
};
export type CategoryInput = CategoryLimits & {
  key: string;
  label: LocalisedText;
  icon: string;
  illustrativeRateBps?: number | null;
  sortOrder?: number;
  segmentKeys: string[];
  purposes?: PurposeInput[];
};
export type CategoryPatch = Partial<Omit<CategoryInput, 'key' | 'purposes'>> & { status?: CatalogStatus };

@Injectable()
export class CatalogAdminService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTx>,
    private readonly catalog: CatalogRepository,
    private readonly cache: CacheService,
    private readonly outbox: OutboxService,
    private readonly audit: AuditService,
  ) {}

  async listSegments() {
    return (await this.catalog.listSegments(false)).map(toSegmentAdminView);
  }

  createSegment(input: SegmentInput) {
    return this.mutate(async () => {
      const segment = await this.catalog.createSegment(input);
      await this.recordChange(AuditAction.CatalogCreated, AuditEntity.Segment, segment.id, { key: segment.key });
      return toSegmentAdminView(segment);
    });
  }

  updateSegment(id: string, patch: SegmentPatch, expectedVersion: number | undefined) {
    return this.mutate(async () => {
      const segment = await this.catalog.findSegment(id);
      if (!segment) throw new AppError(ErrorCode.NOT_FOUND);
      assertVersion(expectedVersion, segment.version);
      const result = await this.catalog.updateSegmentVersioned(id, segment.version, {
        ...patch,
        description: patch.description === null ? Prisma.DbNull : patch.description,
      });
      if (result.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT, { details: { currentVersion: segment.version + 1 } });
      await this.recordChange(AuditAction.CatalogChanged, AuditEntity.Segment, id, { fields: Object.keys(patch) });
      return toSegmentAdminView(await this.requireSegment(id));
    });
  }

  createSubSegment(segmentId: string, input: SubSegmentInput) {
    return this.mutate(async () => {
      await this.requireSegment(segmentId);
      const sub = await this.catalog.createSubSegment({ ...input, segmentId });
      await this.recordChange(AuditAction.CatalogCreated, AuditEntity.SubSegment, sub.id, { key: sub.key, segmentId });
      return toSubSegmentAdminView(sub);
    });
  }

  updateSubSegment(id: string, patch: SubSegmentPatch, expectedVersion: number | undefined) {
    return this.mutate(async () => {
      const sub = await this.catalog.findSubSegment(id);
      if (!sub) throw new AppError(ErrorCode.NOT_FOUND);
      assertVersion(expectedVersion, sub.version);
      const result = await this.catalog.updateSubSegmentVersioned(id, sub.version, patch);
      if (result.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT, { details: { currentVersion: sub.version + 1 } });
      await this.recordChange(AuditAction.CatalogChanged, AuditEntity.SubSegment, id, { fields: Object.keys(patch) });
      return toSubSegmentAdminView((await this.catalog.findSubSegment(id)) ?? sub);
    });
  }

  async listCategories() {
    return (await this.catalog.listCategories({})).map(toCategoryAdminView);
  }

  async getCategory(id: string) {
    return toCategoryAdminView(await this.requireCategory(id));
  }

  createCategory(input: CategoryInput) {
    return this.mutate(async () => {
      assertLimits(input);
      const segments = await this.resolveSegments(input.segmentKeys);
      const category = await this.catalog.createCategory({
        key: input.key,
        label: input.label,
        icon: input.icon,
        minAmountPaise: paiseFromNumber(input.minAmountPaise),
        maxAmountPaise: paiseFromNumber(input.maxAmountPaise),
        stepPaise: paiseFromNumber(input.stepPaise),
        defaultAmountPaise: paiseFromNumber(input.defaultAmountPaise),
        tenureOptionsMonths: normaliseTenures(input.tenureOptionsMonths),
        illustrativeRateBps: input.illustrativeRateBps ?? null,
        sortOrder: input.sortOrder ?? 0,
        segments: { create: segments.map((segment, index) => ({ segmentId: segment.id, sortOrder: index })) },
        purposes: { create: (input.purposes ?? []).map((purpose, index) => ({ ...purpose, sortOrder: purpose.sortOrder ?? index })) },
      });
      await this.recordChange(AuditAction.CatalogCreated, AuditEntity.LoanCategory, category.id, { key: category.key });
      return toCategoryAdminView(category);
    });
  }

  updateCategory(id: string, patch: CategoryPatch, expectedVersion: number | undefined) {
    return this.mutate(async () => {
      const category = await this.requireCategory(id);
      assertVersion(expectedVersion, category.version);
      const merged: CategoryLimits = {
        minAmountPaise: patch.minAmountPaise ?? paiseToNumber(category.minAmountPaise),
        maxAmountPaise: patch.maxAmountPaise ?? paiseToNumber(category.maxAmountPaise),
        stepPaise: patch.stepPaise ?? paiseToNumber(category.stepPaise),
        defaultAmountPaise: patch.defaultAmountPaise ?? paiseToNumber(category.defaultAmountPaise),
        tenureOptionsMonths: patch.tenureOptionsMonths ?? category.tenureOptionsMonths,
      };
      assertLimits(merged);
      const result = await this.catalog.updateCategoryVersioned(id, category.version, {
        label: patch.label,
        icon: patch.icon,
        minAmountPaise: patch.minAmountPaise === undefined ? undefined : paiseFromNumber(patch.minAmountPaise),
        maxAmountPaise: patch.maxAmountPaise === undefined ? undefined : paiseFromNumber(patch.maxAmountPaise),
        stepPaise: patch.stepPaise === undefined ? undefined : paiseFromNumber(patch.stepPaise),
        defaultAmountPaise: patch.defaultAmountPaise === undefined ? undefined : paiseFromNumber(patch.defaultAmountPaise),
        tenureOptionsMonths: patch.tenureOptionsMonths ? normaliseTenures(patch.tenureOptionsMonths) : undefined,
        illustrativeRateBps: patch.illustrativeRateBps,
        sortOrder: patch.sortOrder,
        status: patch.status,
      });
      if (result.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT, { details: { currentVersion: category.version + 1 } });
      if (patch.segmentKeys) {
        const segments = await this.resolveSegments(patch.segmentKeys);
        await this.catalog.replaceCategorySegments(id, segments.map((segment) => segment.id));
      }
      await this.recordChange(AuditAction.CatalogChanged, AuditEntity.LoanCategory, id, { fields: Object.keys(patch) });
      return toCategoryAdminView(await this.requireCategory(id));
    });
  }

  createPurpose(categoryId: string, input: PurposeInput) {
    return this.mutate(async () => {
      await this.requireCategory(categoryId);
      const purpose = await this.catalog.createPurpose({ ...input, categoryId });
      await this.recordChange(AuditAction.CatalogCreated, AuditEntity.CategoryPurpose, purpose.id, { categoryId, key: purpose.key });
      return toPurposeAdminView(purpose);
    });
  }

  updatePurpose(categoryId: string, purposeId: string, patch: PurposePatch, expectedVersion: number | undefined) {
    return this.mutate(async () => {
      const purpose = await this.catalog.findPurpose(purposeId);
      if (!purpose || purpose.categoryId !== categoryId) throw new AppError(ErrorCode.NOT_FOUND);
      assertVersion(expectedVersion, purpose.version);
      const result = await this.catalog.updatePurposeVersioned(purposeId, purpose.version, patch);
      if (result.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT, { details: { currentVersion: purpose.version + 1 } });
      await this.recordChange(AuditAction.CatalogChanged, AuditEntity.CategoryPurpose, purposeId, { fields: Object.keys(patch) });
      return toPurposeAdminView((await this.catalog.findPurpose(purposeId)) ?? purpose);
    });
  }

  private async mutate<T>(work: () => Promise<T>): Promise<T> {
    const result = await this.txHost.withTransaction(work);
    await this.cache.invalidate(CatalogCacheTag.Catalog);
    return result;
  }

  private async recordChange(action: AuditAction, entityType: AuditEntity, entityId: string, metadata: Record<string, unknown>) {
    await this.audit.record({ action, entityType, entityId, metadata });
    await this.outbox.publish({ name: EventName.CatalogChanged, aggregateType: entityType, aggregateId: entityId, payload: { entityType, entityId, action } });
  }

  private async requireSegment(id: string) {
    const segment = await this.catalog.findSegment(id);
    if (!segment) throw new AppError(ErrorCode.NOT_FOUND);
    return segment;
  }

  private async requireCategory(id: string) {
    const category = await this.catalog.findCategory(id);
    if (!category) throw new AppError(ErrorCode.NOT_FOUND);
    return category;
  }

  private async resolveSegments(keys: string[]) {
    const unique = [...new Set(keys)];
    const segments = await this.catalog.findSegmentsByKeys(unique);
    const missing = unique.filter((key) => !segments.some((segment) => segment.key === key));
    if (missing.length > 0) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'segmentKeys', code: 'unknown_segment', message: `unknown segments: ${missing.join(', ')}` }] });
    }
    return unique.map((key) => segments.find((segment) => segment.key === key) as (typeof segments)[number]);
  }
}

const normaliseTenures = (tenures: number[]) => [...new Set(tenures)].toSorted((a, b) => a - b);

function assertLimits(limits: CategoryLimits) {
  const problems: Array<{ path: string; message: string }> = [];
  if (limits.minAmountPaise > limits.maxAmountPaise) problems.push({ path: 'minAmountPaise', message: 'must not exceed maxAmountPaise' });
  if (limits.defaultAmountPaise < limits.minAmountPaise || limits.defaultAmountPaise > limits.maxAmountPaise) {
    problems.push({ path: 'defaultAmountPaise', message: 'must be between minAmountPaise and maxAmountPaise' });
  }
  if (limits.stepPaise > limits.maxAmountPaise - limits.minAmountPaise && limits.maxAmountPaise !== limits.minAmountPaise) {
    problems.push({ path: 'stepPaise', message: 'must not exceed the amount range' });
  }
  if (limits.tenureOptionsMonths.length === 0) problems.push({ path: 'tenureOptionsMonths', message: 'needs at least one option' });
  if (problems.length > 0) {
    throw new AppError(ErrorCode.VALIDATION_FAILED, { details: problems.map((problem) => ({ ...problem, code: 'invalid_limits' })) });
  }
}
