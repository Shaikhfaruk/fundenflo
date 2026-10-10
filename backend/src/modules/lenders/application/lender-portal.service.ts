import { Injectable } from '@nestjs/common';

import type { UserActor } from '../../../common/context/actor.js';
import { ConfigResource } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { EventName } from '../../../common/events/event-names.js';
import type { CompiledLenderProduct } from '../../../engines/lending/lending.types.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { ConfigPublishingService } from '../../config-publishing/application/config-publishing.service.js';
import { LENDER_PRODUCT_KEY_SEPARATOR } from '../domain/lender.constants.js';
import { LenderService } from './lender.service.js';

@Injectable()
export class LenderPortalService {
  constructor(
    private readonly lenders: LenderService,
    private readonly config: ConfigPublishingService,
    private readonly changes: ChangeRecorder,
  ) {}

  async products(actor: UserActor) {
    const lender = await this.lenderOf(actor);
    const products = (await this.config.active<CompiledLenderProduct>(ConfigResource.lender_product)).filter((product) => product.compiled.lenderId === lender.id);
    const items = await Promise.all(
      products.map(async (product) => {
        const [document, version] = await Promise.all([this.config.getDocument(ConfigResource.lender_product, product.documentId), this.config.getVersion(ConfigResource.lender_product, product.documentId, product.number)]);
        return {
          id: product.documentId,
          key: product.key,
          name: document.name,
          versionId: product.versionId,
          number: product.number,
          effectiveFrom: product.effectiveFrom.toISOString(),
          definition: product.compiled,
          content: version.content,
          pendingVersion: document.openVersion,
        };
      }),
    );
    return { lender: { id: lender.id, key: lender.key, name: lender.organization.name, status: lender.status }, items };
  }

  async propose(documentId: string, input: { content: unknown; reason: string }, actor: UserActor) {
    const lender = await this.lenderOf(actor);
    const document = await this.config.getDocument(ConfigResource.lender_product, documentId);
    if (!document.key.startsWith(`${lender.key}${LENDER_PRODUCT_KEY_SEPARATOR}`)) throw new AppError(ErrorCode.NOT_FOUND);
    const draft = await this.config.createVersion(ConfigResource.lender_product, documentId, { content: input.content, notes: input.reason }, actor);
    const request = await this.config.submit(ConfigResource.lender_product, documentId, draft.number, input.reason, draft.version, actor);
    await this.changes.record({ action: AuditAction.LenderProductProposed, entityType: AuditEntity.Lender, entityId: lender.id, event: EventName.LenderProductProposed, metadata: { documentId, number: draft.number, changeRequestId: request.changeRequest?.id ?? null }, payload: { lenderId: lender.id, documentId, number: draft.number } });
    return request;
  }

  private async lenderOf(actor: UserActor) {
    if (!actor.organizationId) throw new AppError(ErrorCode.CONTEXT_NOT_ALLOWED);
    return this.lenders.forOrganization(actor.organizationId);
  }
}
