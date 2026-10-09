import { TransactionHost } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import type { Actor } from '../../../common/context/actor.js';
import { RequestContext } from '../../../common/context/request-context.service.js';
import { ActorType } from '../../../common/enums/db.enums.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { PrismaTx } from '../../../infrastructure/database/database.types.js';
import type { AuditAction, AuditEntity } from '../domain/audit.constants.js';

export type AuditRecordInput = {
  action: AuditAction;
  entityType: AuditEntity;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  actor?: Actor;
};

@Injectable()
export class AuditService {
  constructor(
    private readonly txHost: TransactionHost<PrismaTx>,
    private readonly context: RequestContext,
  ) {}

  async record(input: AuditRecordInput): Promise<void> {
    const actor = input.actor ?? this.context.actor;
    const user = actor?.type === 'user' ? actor : undefined;
    const metadata = { ...input.metadata, ...(actor?.type === 'system' ? { systemActor: actor.name } : {}) };

    await this.txHost.tx.auditEvent.create({
      data: {
        actorType: user ? ActorType.user : ActorType.system,
        actorUserId: user?.userId ?? null,
        actorMembershipId: user?.membershipId ?? null,
        actorContext: user?.context ?? null,
        sessionId: user?.sessionId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        requestId: this.context.requestId ?? null,
        ip: this.context.ip ?? null,
        userAgent: this.context.userAgent ?? null,
        metadata: Object.keys(metadata).length > 0 ? (metadata as Prisma.InputJsonValue) : undefined,
      },
    });
  }
}
