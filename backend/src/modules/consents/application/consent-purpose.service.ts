import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { CatalogStatus, type ConsentBasis, ConsentScopeKind, type OrganizationType } from '../../../common/enums/db.enums.js';
import { EventName } from '../../../common/events/event-names.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { assertVersion } from '../../../common/http/versioning.js';
import type { LocalisedText } from '../../../common/i18n/locale.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { runThenInvalidate } from '../../../infrastructure/cache/run-then-invalidate.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { CONSENT_CACHE_TTL_SECONDS, CONSENT_PURPOSE_CACHE_TAG } from '../domain/consent.constants.js';
import { ConsentRepository } from '../infrastructure/consent.repository.js';
import { type PurposeView, toPurposeView } from './consent.views.js';

export type PurposeInput = {
  key: string;
  label: LocalisedText;
  description?: LocalisedText;
  scopeKind: ConsentScopeKind;
  scopeOrganizationType?: OrganizationType;
  allowedBases: ConsentBasis[];
  validityDays?: number;
};

export type PurposePatch = {
  label?: LocalisedText;
  description?: LocalisedText | null;
  allowedBases?: ConsentBasis[];
  validityDays?: number | null;
  status?: CatalogStatus;
};

@Injectable()
export class ConsentPurposeService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTx>,
    private readonly consents: ConsentRepository,
    private readonly cache: CacheService,
    private readonly changes: ChangeRecorder,
  ) {}

  async active(): Promise<Map<string, PurposeView>> {
    const views = await this.cache.wrap('consent-purposes:active', [CONSENT_PURPOSE_CACHE_TAG], CONSENT_CACHE_TTL_SECONDS, async () =>
      (await this.consents.listPurposes({ status: CatalogStatus.active })).map(toPurposeView),
    );
    return new Map(views.map((view) => [view.key, view]));
  }

  async list(status?: CatalogStatus) {
    return (await this.consents.listPurposes({ status })).map(toPurposeView);
  }

  async get(id: string) {
    return toPurposeView(await this.require(id));
  }

  create(input: PurposeInput) {
    const scoped = input.scopeKind === ConsentScopeKind.organizations;
    if (scoped !== Boolean(input.scopeOrganizationType)) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, {
        details: [{ path: 'scopeOrganizationType', code: scoped ? 'required' : 'not_allowed', message: 'scopeOrganizationType is set exactly when scopeKind is organizations' }],
      });
    }
    return runThenInvalidate(this.txHost, this.cache, [CONSENT_PURPOSE_CACHE_TAG], async () => {
      const purpose = await this.consents.createPurpose({
        ...input,
        description: input.description ?? Prisma.DbNull,
        scopeOrganizationType: input.scopeOrganizationType ?? null,
        validityDays: input.validityDays ?? null,
      });
      await this.changes.record({
        action: AuditAction.ConsentPurposeCreated,
        entityType: AuditEntity.ConsentPurpose,
        entityId: purpose.id,
        event: EventName.ConsentPurposeChanged,
        metadata: { key: purpose.key },
      });
      return toPurposeView(purpose);
    });
  }

  update(id: string, patch: PurposePatch, expectedVersion: number | undefined) {
    return runThenInvalidate(this.txHost, this.cache, [CONSENT_PURPOSE_CACHE_TAG], async () => {
      const purpose = await this.require(id);
      assertVersion(expectedVersion, purpose.version);
      const result = await this.consents.updatePurposeVersioned(id, purpose.version, {
        ...patch,
        description: patch.description === null ? Prisma.DbNull : patch.description,
      });
      if (result.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT, { details: { currentVersion: purpose.version + 1 } });
      await this.changes.record({
        action: AuditAction.ConsentPurposeChanged,
        entityType: AuditEntity.ConsentPurpose,
        entityId: id,
        event: EventName.ConsentPurposeChanged,
        metadata: { key: purpose.key, fields: Object.keys(patch) },
      });
      return this.get(id);
    });
  }

  private async require(id: string) {
    const purpose = await this.consents.findPurpose(id);
    if (!purpose) throw new AppError(ErrorCode.NOT_FOUND);
    return purpose;
  }
}
