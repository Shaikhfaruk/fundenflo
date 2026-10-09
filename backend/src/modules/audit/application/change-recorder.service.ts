import { Injectable } from '@nestjs/common';

import type { EventName } from '../../../common/events/event-names.js';
import { OutboxService } from '../../../infrastructure/outbox/outbox.service.js';
import type { AuditAction, AuditEntity } from '../domain/audit.constants.js';
import { AuditService } from './audit.service.js';

export type RecordedChange = {
  action: AuditAction;
  entityType: AuditEntity;
  entityId: string;
  event: EventName;
  metadata?: Record<string, unknown>;
  payload?: Record<string, unknown>;
};

@Injectable()
export class ChangeRecorder {
  constructor(
    private readonly audit: AuditService,
    private readonly outbox: OutboxService,
  ) {}

  async record(change: RecordedChange): Promise<void> {
    await this.audit.record({ action: change.action, entityType: change.entityType, entityId: change.entityId, metadata: change.metadata });
    await this.outbox.publish({
      name: change.event,
      aggregateType: change.entityType,
      aggregateId: change.entityId,
      payload: { entityType: change.entityType, entityId: change.entityId, action: change.action, ...change.payload },
    });
  }
}
