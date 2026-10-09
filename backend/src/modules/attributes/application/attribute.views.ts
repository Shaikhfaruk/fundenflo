import type { LocalisedText } from '../../../common/i18n/locale.js';
import type { FactValue } from '../../../engines/conditions/condition.types.js';
import type { AttributeDefinition, FactProvenance } from '../../../generated/prisma/client.js';
import type { EnumOption } from '../domain/fact-value.js';

export type AttributeView = {
  id: string;
  key: string;
  label: LocalisedText;
  description: LocalisedText | null;
  dataType: string;
  unit: string | null;
  enumValues: EnumOption[] | null;
  subject: string;
  sensitivity: string;
  allowedProvenance: string[];
  freshnessDays: number | null;
  status: string;
  version: number;
  updatedAt: string;
};

export type ResolvedFact = {
  factId: string;
  attributeKey: string;
  value: FactValue;
  provenance: FactProvenance;
  sourceType: string;
  sourceId: string | null;
  confidence: number | null;
  observedAt: string;
  stale: boolean;
};

export const toAttributeView = (definition: AttributeDefinition): AttributeView => ({
  id: definition.id,
  key: definition.key,
  label: definition.label as LocalisedText,
  description: (definition.description as LocalisedText | null) ?? null,
  dataType: definition.dataType,
  unit: definition.unit,
  enumValues: (definition.enumValues as EnumOption[] | null) ?? null,
  subject: definition.subject,
  sensitivity: definition.sensitivity,
  allowedProvenance: definition.allowedProvenance,
  freshnessDays: definition.freshnessDays,
  status: definition.status,
  version: definition.version,
  updatedAt: definition.updatedAt.toISOString(),
});
