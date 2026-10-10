import type { LocalisedText } from '../../common/i18n/locale.js';
import type { Condition, ConditionTrace, Outcome } from '../conditions/condition.types.js';
import type { DocumentSlot } from '../documents/documents.types.js';
import type { RankedLookup } from '../facts/resolve-fact.js';

export const RuleParty = {
  Primary: 'primary',
  AnyCoApplicant: 'any_co_applicant',
  AllDirectors: 'all_directors',
} as const;

export type RuleParty = (typeof RuleParty)[keyof typeof RuleParty];

export type ProductRule = { id: string; when: Condition; minRank: number | null; party: RuleParty; pass: LocalisedText | null; fail: LocalisedText | null };

export type SoftRule = ProductRule & { weight: number };

export type ProductCoverage = { nationwide: boolean; stateIds: string[]; cityIds: string[]; includePincodes: string[]; excludePincodes: string[] };

export type ProductDocument = DocumentSlot & { stage: string };

export type CompiledLenderProduct = {
  lenderId: string;
  lenderKey: string;
  productKey: string;
  category: string;
  segments: string[];
  subSegments: string[];
  amountPaise: { min: number; max: number };
  tenureMonths: { min: number; max: number };
  coverage: ProductCoverage;
  hard: ProductRule[];
  soft: SoftRule[];
  documents: ProductDocument[];
  questionSet: string | null;
  pricingDisclosure: LocalisedText | null;
};

export type CaseLocation = { stateId: string | null; cityId: string | null; pincode: string | null };

export type CaseRequest = { category: string | null; segment: string; subSegment: string | null; amountPaise: number | null; tenureMonths: number | null; location: CaseLocation };

export const ScreenReason = {
  CategoryMismatch: 'category_mismatch',
  SegmentMismatch: 'segment_mismatch',
  SubSegmentMismatch: 'sub_segment_mismatch',
  SubSegmentUnknown: 'sub_segment_unknown',
  AmountOutOfRange: 'amount_out_of_range',
  AmountUnknown: 'amount_unknown',
  TenureOutOfRange: 'tenure_out_of_range',
  TenureUnknown: 'tenure_unknown',
  OutsideCoverage: 'outside_coverage',
  LocationUnknown: 'location_unknown',
} as const;

export type ScreenReason = (typeof ScreenReason)[keyof typeof ScreenReason];

export type ScreenResult = { outcome: Outcome; reasons: Array<{ code: ScreenReason; outcome: Outcome }> };

export type PartyLookups = { primary: RankedLookup; coApplicants: RankedLookup[]; directors: RankedLookup[] };

export type RuleResult = { id: string; outcome: Outcome; party: RuleParty; message: LocalisedText | null; traces: ConditionTrace[] };

export const Eligibility = {
  Eligible: 'eligible',
  Ineligible: 'ineligible',
  NeedsInfo: 'needs_info',
} as const;

export type Eligibility = (typeof Eligibility)[keyof typeof Eligibility];

export type EligibilityResult = { eligibility: Eligibility; hard: RuleResult[]; soft: RuleResult[]; softScore: number; softMax: number; missingAttributes: string[] };
