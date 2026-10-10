import { Outcome } from '../conditions/condition.types.js';
import { coverageOutcome } from './coverage.js';
import { type CaseRequest, type CompiledLenderProduct, ScreenReason, type ScreenResult } from './lending.types.js';

const within = (value: number | null, range: { min: number; max: number }, outside: ScreenReason, unknown: ScreenReason) => {
  if (value === null) return { code: unknown, outcome: Outcome.Unknown };
  return value >= range.min && value <= range.max ? null : { code: outside, outcome: Outcome.Fail };
};

export function screenProduct(product: CompiledLenderProduct, request: CaseRequest): ScreenResult {
  const reasons: ScreenResult['reasons'] = [];
  if (request.category !== null && request.category !== product.category) reasons.push({ code: ScreenReason.CategoryMismatch, outcome: Outcome.Fail });
  if (!product.segments.includes(request.segment)) reasons.push({ code: ScreenReason.SegmentMismatch, outcome: Outcome.Fail });
  if (product.subSegments.length > 0) {
    if (request.subSegment === null) reasons.push({ code: ScreenReason.SubSegmentUnknown, outcome: Outcome.Unknown });
    else if (!product.subSegments.includes(request.subSegment)) reasons.push({ code: ScreenReason.SubSegmentMismatch, outcome: Outcome.Fail });
  }
  for (const reason of [within(request.amountPaise, product.amountPaise, ScreenReason.AmountOutOfRange, ScreenReason.AmountUnknown), within(request.tenureMonths, product.tenureMonths, ScreenReason.TenureOutOfRange, ScreenReason.TenureUnknown)]) {
    if (reason) reasons.push(reason);
  }
  const coverage = coverageOutcome(product.coverage, request.location);
  if (coverage === Outcome.Fail) reasons.push({ code: ScreenReason.OutsideCoverage, outcome: Outcome.Fail });
  if (coverage === Outcome.Unknown) reasons.push({ code: ScreenReason.LocationUnknown, outcome: Outcome.Unknown });
  const outcome = reasons.some((reason) => reason.outcome === Outcome.Fail) ? Outcome.Fail : reasons.length > 0 ? Outcome.Unknown : Outcome.Pass;
  return { outcome, reasons };
}
