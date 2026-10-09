import { Injectable } from '@nestjs/common';

import { CatalogStatus, DataSensitivity, type FactProvenance } from '../../../common/enums/db.enums.js';
import { EventName } from '../../../common/events/event-names.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { type PageQuery, pageWindow, toPage } from '../../../common/listing/cursor-page.js';
import type { FactLookup, FactValue } from '../../../engines/conditions/condition.types.js';
import { isStale, resolveFact } from '../../../engines/facts/resolve-fact.js';
import type { BorrowerFact, Prisma } from '../../../generated/prisma/client.js';
import { CipherPurpose } from '../../../infrastructure/crypto/crypto.constants.js';
import { FieldCipher } from '../../../infrastructure/crypto/field-cipher.service.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { PartyService } from '../../parties/application/party.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { type FactSourceType, MAX_FACTS_PER_WRITE, PROVENANCE_RANK } from '../domain/attribute.constants.js';
import { type AttributeShape, normaliseFactValue } from '../domain/fact-value.js';
import { FactRepository } from '../infrastructure/fact.repository.js';
import { AttributeDictionary } from './attribute-dictionary.service.js';
import type { AttributeView, ResolvedFact } from './attribute.views.js';

export type FactInput = {
  attributeKey: string;
  value: unknown;
  confidence?: number;
  observedAt?: Date;
  validUntil?: Date;
  sourceId?: string;
};

export type FactContext = {
  provenance: FactProvenance;
  sourceType: FactSourceType;
  sourceId?: string;
  leadId?: string;
  applicationId?: string;
  recordedByUserId?: string;
};

const shapeOf = (view: AttributeView): AttributeShape => ({ dataType: view.dataType as AttributeShape['dataType'], enumValues: view.enumValues });

@Injectable()
export class FactService {
  constructor(
    private readonly facts: FactRepository,
    private readonly dictionary: AttributeDictionary,
    private readonly cipher: FieldCipher,
    private readonly changes: ChangeRecorder,
    private readonly parties: PartyService,
  ) {}

  async record(partyId: string, inputs: FactInput[], context: FactContext): Promise<ResolvedFact[]> {
    if (inputs.length === 0) return [];
    if (inputs.length > MAX_FACTS_PER_WRITE) {
      throw new AppError(ErrorCode.VALIDATION_FAILED, { details: [{ path: 'facts', code: 'too_big', message: `at most ${MAX_FACTS_PER_WRITE} facts per write` }] });
    }
    await this.parties.assertExists(partyId);
    const dictionary = await this.dictionary.active();
    const problems: Array<{ path: string; code: string; message: string }> = [];
    const now = new Date();

    const rows: Prisma.BorrowerFactCreateManyInput[] = inputs.flatMap((input, index) => {
      const definition = dictionary.get(input.attributeKey);
      const path = `facts[${index}]`;
      if (!definition) {
        problems.push({ path: `${path}.attributeKey`, code: 'unknown_attribute', message: `unknown or inactive attribute ${input.attributeKey}` });
        return [];
      }
      if (!definition.allowedProvenance.includes(context.provenance)) {
        problems.push({ path: `${path}.attributeKey`, code: 'provenance_not_allowed', message: `${input.attributeKey} does not accept ${context.provenance} facts` });
        return [];
      }
      const normalised = normaliseFactValue(shapeOf(definition), input.value);
      if (!normalised.ok) {
        problems.push({ path: `${path}.value`, code: 'invalid_value', message: normalised.message });
        return [];
      }
      const sensitive = definition.sensitivity === DataSensitivity.special;
      return [
        {
          partyId,
          attributeKey: definition.key,
          leadId: context.leadId ?? null,
          applicationId: context.applicationId ?? null,
          valueJson: sensitive ? undefined : { value: normalised.value },
          valueEnc: sensitive ? this.cipher.encryptJson(normalised.value, CipherPurpose.BorrowerFact) : null,
          valueMin: sensitive ? null : normalised.min,
          valueMax: sensitive ? null : normalised.max,
          provenance: context.provenance,
          sourceType: context.sourceType,
          sourceId: input.sourceId ?? context.sourceId ?? null,
          confidence: input.confidence ?? null,
          observedAt: input.observedAt ?? now,
          validUntil: input.validUntil ?? null,
          recordedByUserId: context.recordedByUserId ?? null,
        },
      ];
    });
    if (problems.length > 0) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: problems });

    const created = await this.facts.createMany(rows);
    await this.changes.record({
      action: AuditAction.FactsRecorded,
      entityType: AuditEntity.Party,
      entityId: partyId,
      event: EventName.FactsRecorded,
      metadata: { keys: created.map((fact) => fact.attributeKey), provenance: context.provenance, sourceType: context.sourceType, leadId: context.leadId ?? null },
      payload: { partyId, keys: created.map((fact) => fact.attributeKey), leadId: context.leadId ?? null },
    });
    return created.map((fact) => this.toResolved(fact, dictionary.get(fact.attributeKey), now));
  }

  async current(partyId: string, attributeKeys?: string[]): Promise<Map<string, ResolvedFact>> {
    const dictionary = await this.dictionary.active();
    const now = new Date();
    const grouped = Map.groupBy(await this.facts.listForParty(partyId, attributeKeys), (fact) => fact.attributeKey);
    const best = new Map<string, ResolvedFact>();
    for (const [attributeKey, facts] of grouped) {
      const definition = dictionary.get(attributeKey);
      if (!definition || definition.status !== CatalogStatus.active) continue;
      const winner = resolveFact(facts.map((fact) => ({ ...fact, rank: PROVENANCE_RANK[fact.provenance] })), definition.freshnessDays, now);
      if (winner) best.set(attributeKey, this.toResolved(winner.fact, definition, now));
    }
    return best;
  }

  async snapshot(partyId: string): Promise<ResolvedFact[]> {
    await this.parties.assertExists(partyId);
    return [...(await this.current(partyId)).values()];
  }

  async lookup(partyId: string | null, overlay: Record<string, FactValue | undefined> = {}): Promise<FactLookup> {
    if (partyId) await this.parties.assertExists(partyId);
    const current = partyId ? await this.current(partyId) : new Map<string, ResolvedFact>();
    return (attr) => {
      if (overlay[attr] !== undefined) return overlay[attr];
      const fact = current.get(attr);
      return fact && !fact.stale ? fact.value : undefined;
    };
  }

  async history(partyId: string, filters: PageQuery & { attributeKey?: string }) {
    await this.parties.assertExists(partyId);
    const dictionary = await this.dictionary.active();
    const window = pageWindow(filters);
    const rows = await this.facts.history(partyId, filters.attributeKey, window.take, window.idFilter);
    const now = new Date();
    return toPage(rows, filters.limit, (fact) => this.toResolved(fact, dictionary.get(fact.attributeKey), now));
  }

  private toResolved(fact: BorrowerFact, definition: AttributeView | undefined, now: Date): ResolvedFact {
    const value = fact.valueEnc
      ? this.cipher.decryptJson<FactValue>(fact.valueEnc, CipherPurpose.BorrowerFact)
      : ((fact.valueJson as { value?: FactValue } | null)?.value ?? null);
    return {
      factId: fact.id,
      attributeKey: fact.attributeKey,
      value,
      provenance: fact.provenance,
      sourceType: fact.sourceType,
      sourceId: fact.sourceId,
      confidence: fact.confidence === null ? null : Number(fact.confidence),
      observedAt: fact.observedAt.toISOString(),
      stale: isStale(fact.observedAt, definition?.freshnessDays, now),
    };
  }
}
