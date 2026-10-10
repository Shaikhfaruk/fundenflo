import { Injectable } from '@nestjs/common';

import { FactProvenance, SignalStatus } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { EventName } from '../../../common/events/event-names.js';
import { type PageQuery, pageWindow, toPage } from '../../../common/listing/cursor-page.js';
import type { FactValue } from '../../../engines/conditions/condition.types.js';
import { compareFacts, severityOf } from '../../../engines/facts/consistency.js';
import type { BorrowerFact, ConsistencySignal, Prisma } from '../../../generated/prisma/client.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { CONSISTENCY_HIGH_FROM_PCT, CONSISTENCY_MEDIUM_FROM_PCT, CONSISTENCY_TOLERANCE_PCT } from '../domain/attribute.constants.js';
import { ConsistencyRepository } from '../infrastructure/consistency.repository.js';

export type SignalFilters = PageQuery & { status?: SignalStatus; partyIds?: string[]; applicationId?: string };

const valueOf = (fact: BorrowerFact): FactValue | undefined => (fact.valueJson as { value?: FactValue } | null)?.value;

export const toSignalView = (signal: ConsistencySignal) => ({
  id: signal.id,
  partyId: signal.partyId,
  applicationId: signal.applicationId,
  attributeKey: signal.attributeKey,
  declaredValue: signal.declaredValue,
  observedValue: signal.observedValue,
  observedProvenance: signal.observedProvenance,
  deviationPct: signal.deviationPct === null ? null : Number(signal.deviationPct),
  severity: signal.severity,
  status: signal.status,
  resolutionNote: signal.resolutionNote,
  resolvedAt: signal.resolvedAt?.toISOString() ?? null,
  version: signal.version,
  createdAt: signal.createdAt.toISOString(),
});

@Injectable()
export class ConsistencyService {
  constructor(
    private readonly signals: ConsistencyRepository,
    private readonly changes: ChangeRecorder,
  ) {}

  async review(partyId: string, observed: BorrowerFact[]): Promise<number> {
    const candidates = observed.filter((fact) => fact.provenance !== FactProvenance.declared && valueOf(fact) !== undefined);
    if (candidates.length === 0) return 0;
    const declared = new Map<string, BorrowerFact>();
    const keys = [...new Set(candidates.map((candidate) => candidate.attributeKey))];
    for (const fact of await this.signals.latestDeclared(partyId, keys)) if (!declared.has(fact.attributeKey)) declared.set(fact.attributeKey, fact);
    const rows: Prisma.ConsistencySignalCreateManyInput[] = [];
    for (const fact of candidates) {
      const claim = declared.get(fact.attributeKey);
      const claimed = claim ? valueOf(claim) : undefined;
      const seen = valueOf(fact);
      if (!claim || claimed === undefined || seen === undefined) continue;
      const deviation = compareFacts(claimed, seen, CONSISTENCY_TOLERANCE_PCT);
      if (!deviation.deviates) continue;
      rows.push({
        partyId,
        applicationId: fact.applicationId,
        attributeKey: fact.attributeKey,
        declaredFactId: claim.id,
        observedFactId: fact.id,
        observedProvenance: fact.provenance,
        declaredValue: claimed as Prisma.InputJsonValue,
        observedValue: seen as Prisma.InputJsonValue,
        deviationPct: deviation.deviationPct,
        severity: severityOf(deviation.deviationPct, CONSISTENCY_MEDIUM_FROM_PCT, CONSISTENCY_HIGH_FROM_PCT),
      });
    }
    if (rows.length === 0) return 0;
    const created = await this.signals.createSignals(rows);
    for (const signal of created) {
      await this.changes.record({
        action: AuditAction.ConsistencySignalRaised,
        entityType: AuditEntity.ConsistencySignal,
        entityId: signal.id,
        event: EventName.ConsistencySignalRaised,
        metadata: { partyId, attributeKey: signal.attributeKey, severity: signal.severity, deviationPct: signal.deviationPct === null ? null : Number(signal.deviationPct) },
        payload: { signalId: signal.id, partyId, applicationId: signal.applicationId, attributeKey: signal.attributeKey, severity: signal.severity },
      });
    }
    return created.length;
  }

  async openCount(partyIds: string[]): Promise<number> {
    return (await this.signals.list({ partyId: { in: partyIds }, status: SignalStatus.open }, 1_000)).length;
  }

  async list(filters: SignalFilters) {
    const window = pageWindow(filters);
    const rows = await this.signals.list({ id: window.idFilter, status: filters.status, ...(filters.partyIds ? { partyId: { in: filters.partyIds } } : {}), applicationId: filters.applicationId }, window.take);
    return toPage(rows, filters.limit, toSignalView);
  }

  async resolve(id: string, input: { status: typeof SignalStatus.resolved | typeof SignalStatus.dismissed; note: string }, userId: string) {
    const signal = await this.signals.find(id);
    if (!signal) throw new AppError(ErrorCode.NOT_FOUND);
    const moved = await this.signals.updateFromStatus(id, SignalStatus.open, { status: input.status, resolutionNote: input.note, resolvedByUserId: userId, resolvedAt: new Date() });
    if (moved.count === 0) throw new AppError(ErrorCode.INVALID_TRANSITION, { details: { from: signal.status, event: input.status, allowed: [] } });
    await this.changes.record({ action: AuditAction.ConsistencySignalResolved, entityType: AuditEntity.ConsistencySignal, entityId: id, event: EventName.ConsistencySignalResolved, metadata: { status: input.status, note: input.note }, payload: { signalId: id, partyId: signal.partyId, status: input.status } });
    const updated = await this.signals.find(id);
    if (!updated) throw new AppError(ErrorCode.NOT_FOUND);
    return toSignalView(updated);
  }
}
