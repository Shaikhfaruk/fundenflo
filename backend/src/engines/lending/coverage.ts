import { Outcome } from '../conditions/condition.types.js';
import type { CaseLocation, ProductCoverage } from './lending.types.js';

export function coverageOutcome(coverage: ProductCoverage, location: CaseLocation): Outcome {
  if (location.pincode && coverage.excludePincodes.includes(location.pincode)) return Outcome.Fail;
  if (location.pincode && coverage.includePincodes.includes(location.pincode)) return Outcome.Pass;
  if (coverage.nationwide) return Outcome.Pass;
  if (location.cityId && coverage.cityIds.includes(location.cityId)) return Outcome.Pass;
  if (location.stateId && coverage.stateIds.includes(location.stateId)) return Outcome.Pass;
  if (!location.stateId && !location.cityId && !location.pincode) return Outcome.Unknown;
  return Outcome.Fail;
}
