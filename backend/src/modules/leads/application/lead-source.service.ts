import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { CatalogStatus, type ConsentBasis, type LeadSourceKind } from '../../../common/enums/db.enums.js';
import { EventName } from '../../../common/events/event-names.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { assertVersion } from '../../../common/http/versioning.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { LeadRepository } from '../infrastructure/lead.repository.js';
import { type LeadSourceView, toLeadSourceView } from './lead.views.js';

export type LeadSourceInput = { key: string; name: string; kind: LeadSourceKind; questionSetStage?: string; consentContext?: string; defaultLawfulBasis?: ConsentBasis };

export type LeadSourcePatch = { name?: string; questionSetStage?: string | null; consentContext?: string | null; defaultLawfulBasis?: ConsentBasis | null; status?: CatalogStatus };

@Injectable()
export class LeadSourceService {
  constructor(
    private readonly leads: LeadRepository,
    private readonly changes: ChangeRecorder,
  ) {}

  async list(status?: CatalogStatus) {
    return (await this.leads.listSources({ status })).map(toLeadSourceView);
  }

  async get(id: string) {
    return toLeadSourceView(await this.require(id));
  }

  async activeById(id: string): Promise<LeadSourceView> {
    const source = await this.leads.findSource(id);
    if (source?.status !== CatalogStatus.active) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'source', code: 'inactive_source', message: 'lead source is missing or inactive' }] });
    return toLeadSourceView(source);
  }

  async activeByKey(key: string): Promise<LeadSourceView> {
    const source = await this.leads.findSourceByKey(key);
    if (source?.status !== CatalogStatus.active) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'source', code: 'inactive_source', message: `lead source ${key} is missing or inactive` }] });
    return toLeadSourceView(source);
  }

  @Transactional()
  async create(input: LeadSourceInput) {
    const source = await this.leads.createSource(input);
    await this.changes.record({ action: AuditAction.LeadSourceCreated, entityType: AuditEntity.LeadSource, entityId: source.id, event: EventName.LeadSourceChanged, metadata: { key: source.key, kind: source.kind } });
    return toLeadSourceView(source);
  }

  @Transactional()
  async update(id: string, patch: LeadSourcePatch, expectedVersion: number | undefined) {
    const source = await this.require(id);
    assertVersion(expectedVersion, source.version);
    const result = await this.leads.updateSourceVersioned(id, source.version, patch);
    if (result.count === 0) throw new AppError(ErrorCode.VERSION_CONFLICT, { details: { currentVersion: source.version + 1 } });
    await this.changes.record({ action: AuditAction.LeadSourceChanged, entityType: AuditEntity.LeadSource, entityId: id, event: EventName.LeadSourceChanged, metadata: { key: source.key, fields: Object.keys(patch) } });
    return this.get(id);
  }

  private async require(id: string) {
    const source = await this.leads.findSource(id);
    if (!source) throw new AppError(ErrorCode.NOT_FOUND);
    return source;
  }
}
