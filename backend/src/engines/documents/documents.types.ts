import type { LocalisedText } from '../../common/i18n/locale.js';
import type { Condition, Outcome } from '../conditions/condition.types.js';
import type { QuestionScope } from '../questionnaire/questionnaire.types.js';

export type DocumentSlot = {
  key: string;
  documentTypes: string[];
  required: boolean;
  minCount: number;
  when: Condition | null;
  label: LocalisedText | null;
  description: LocalisedText | null;
};

export type CompiledDocumentRequirement = {
  stage: string;
  scope: QuestionScope;
  items: DocumentSlot[];
};

export type ActiveDocumentRequirement = { key: string; versionId: string; requirement: CompiledDocumentRequirement };

export type ChecklistContext = { stage: string; segment?: string; subSegment?: string; category?: string };

export type ChecklistItem = DocumentSlot & { requirementKey: string; versionId: string; applicability: Outcome; neededBy: string[] };

export type Checklist = { requirements: Array<{ key: string; versionId: string }>; items: ChecklistItem[]; hidden: string[] };
