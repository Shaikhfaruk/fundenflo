import type { LocalisedText } from '../../common/i18n/locale.js';
import type { CaseRequest, CompiledLenderProduct, EligibilityResult, PartyLookups, ScreenResult } from '../lending/lending.types.js';

export type MatchCandidate = { productDocumentId: string; productKey: string; productVersionId: string; product: CompiledLenderProduct };

export type MatchInput = { request: CaseRequest; lookups: PartyLookups; heldDocumentTypes: ReadonlySet<string>; documentStages: readonly string[] };

export type ProductMatch = {
  productDocumentId: string;
  productKey: string;
  productVersionId: string;
  lenderId: string;
  outcome: 'eligible' | 'ineligible' | 'needs_info';
  screen: ScreenResult;
  eligibility: EligibilityResult;
  fit: number;
  reasons: LocalisedText[];
  documentsNeeded: string[];
  rank: number;
};
