import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { SlaTimerStatus } from '../../../common/enums/db.enums.js';
import { SLA_SWEEP_BATCH_SIZE } from '../domain/sla.constants.js';
import type { SlaEntity, SlaFireResult } from '../domain/sla.types.js';
import { SlaRepository } from '../infrastructure/sla.repository.js';
import { SlaHandlerRegistry } from './sla-handler.registry.js';

@Injectable()
export class SlaService {
  constructor(
    private readonly timers: SlaRepository,
    private readonly handlers: SlaHandlerRegistry,
  ) {}

  async start(kind: string, entity: SlaEntity, dueAt: Date, warnAt: Date | null = null) {
    this.handlers.get(kind);
    await this.timers.closePending({ kind, entityId: entity.id }, { status: SlaTimerStatus.cancelled, cancelledAt: new Date() });
    return this.timers.create({ kind, entityType: entity.type, entityId: entity.id, dueAt, warnAt: warnAt && warnAt < dueAt ? warnAt : null });
  }

  async satisfy(kind: string, entityId: string, at = new Date()) {
    return (await this.timers.closePending({ kind, entityId }, { status: SlaTimerStatus.satisfied, satisfiedAt: at })).count;
  }

  async cancel(entityId: string, kinds?: string[]) {
    return (await this.timers.closePending({ entityId, ...(kinds ? { kind: { in: kinds } } : {}) }, { status: SlaTimerStatus.cancelled, cancelledAt: new Date() })).count;
  }

  timersFor(entityType: string, entityIds: string[]) {
    return this.timers.listForEntity(entityType, entityIds);
  }

  async sweep(now = new Date()) {
    const due = await this.timers.findDueIds(now, SLA_SWEEP_BATCH_SIZE);
    const results: Record<SlaFireResult, number> = { warned: 0, breached: 0, skipped: 0 };
    for (const { id } of due) results[await this.fire(id, now)] += 1;
    return results;
  }

  @Transactional()
  async fire(id: string, now = new Date()): Promise<SlaFireResult> {
    const timer = await this.timers.claim(id);
    if (!timer) return 'skipped';
    const handler = this.handlers.get(timer.kind);
    if (timer.dueAt <= now) {
      const breached = await this.timers.update(timer.id, { status: SlaTimerStatus.breached, breachedAt: now });
      await handler.breach(breached);
      return 'breached';
    }
    if (!timer.warnAt || timer.warnAt > now || timer.warnedAt) return 'skipped';
    const warned = await this.timers.update(timer.id, { warnedAt: now });
    await handler.warn?.(warned);
    return 'warned';
  }
}
