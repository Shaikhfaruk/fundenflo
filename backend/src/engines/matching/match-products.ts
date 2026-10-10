import { Outcome } from '../conditions/condition.types.js';
import { evaluateProduct } from '../lending/evaluate-product.js';
import { Eligibility, type ProductDocument } from '../lending/lending.types.js';
import { screenProduct } from '../lending/screen-product.js';
import type { MatchCandidate, MatchInput, ProductMatch } from './matching.types.js';

const PERCENT = 100;

const ORDER: Record<ProductMatch['outcome'], number> = { eligible: 0, needs_info: 1, ineligible: 2 };

export const COVERAGE_REASON = { en: 'They lend in your area', hi: 'वे आपके क्षेत्र में ऋण देते हैं' };

function outcomeOf(screen: ProductMatch['screen'], eligibility: ProductMatch['eligibility']): ProductMatch['outcome'] {
  if (screen.outcome === Outcome.Fail || eligibility.eligibility === Eligibility.Ineligible) return 'ineligible';
  if (screen.outcome === Outcome.Unknown || eligibility.eligibility === Eligibility.NeedsInfo) return 'needs_info';
  return 'eligible';
}

export function documentsNeeded(documents: readonly ProductDocument[], stages: readonly string[], held: ReadonlySet<string>): string[] {
  return documents.filter((slot) => slot.required && stages.includes(slot.stage) && !slot.documentTypes.some((type) => held.has(type))).map((slot) => slot.key);
}

export function matchProducts(candidates: readonly MatchCandidate[], input: MatchInput): ProductMatch[] {
  const evaluated = candidates.map((candidate) => {
    const screen = screenProduct(candidate.product, input.request);
    const eligibility = evaluateProduct(candidate.product, input.lookups);
    const outcome = outcomeOf(screen, eligibility);
    const reasons = [
      ...(screen.outcome === Outcome.Pass ? [COVERAGE_REASON] : []),
      ...[...eligibility.hard, ...eligibility.soft].filter((rule) => rule.outcome === Outcome.Pass && rule.message).map((rule) => rule.message as NonNullable<typeof rule.message>),
    ];
    const needed = documentsNeeded(candidate.product.documents, input.documentStages, input.heldDocumentTypes);
    const fit = eligibility.softMax > 0 ? Math.round((eligibility.softScore / eligibility.softMax) * PERCENT) : PERCENT;
    return { productDocumentId: candidate.productDocumentId, productKey: candidate.productKey, productVersionId: candidate.productVersionId, lenderId: candidate.product.lenderId, outcome, screen, eligibility, fit, reasons, documentsNeeded: needed, rank: 0 };
  });
  return evaluated
    .toSorted((left, right) => ORDER[left.outcome] - ORDER[right.outcome] || right.fit - left.fit || left.documentsNeeded.length - right.documentsNeeded.length || left.productKey.localeCompare(right.productKey))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}
