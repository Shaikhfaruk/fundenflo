import { LEAD_QUALITY_WEIGHTS } from './lead.constants.js';

export type LeadQualityInput = {
  hasMobile: boolean;
  hasEmail: boolean;
  hasName: boolean;
  segmentKey: string | null;
  categoryKey: string | null;
  hasAmount: boolean;
  locationResolved: boolean;
  consentOk: boolean;
};

export function scoreLead(input: LeadQualityInput): number {
  const parts: Array<[boolean, number]> = [
    [input.hasMobile, LEAD_QUALITY_WEIGHTS.mobile],
    [input.hasEmail, LEAD_QUALITY_WEIGHTS.email],
    [input.hasName, LEAD_QUALITY_WEIGHTS.name],
    [Boolean(input.segmentKey), LEAD_QUALITY_WEIGHTS.segment],
    [Boolean(input.categoryKey), LEAD_QUALITY_WEIGHTS.category],
    [input.hasAmount, LEAD_QUALITY_WEIGHTS.amount],
    [input.locationResolved, LEAD_QUALITY_WEIGHTS.location],
    [input.consentOk, LEAD_QUALITY_WEIGHTS.consent],
  ];
  return Math.min(100, parts.reduce((total, [present, weight]) => total + (present ? weight : 0), 0));
}
