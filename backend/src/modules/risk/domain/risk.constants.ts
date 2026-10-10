import { RiskSeverity } from '../../../common/enums/db.enums.js';
import { HOUR_MS } from '../../../common/constants/time.constants.js';

export const SEVERITY_RANK: Record<RiskSeverity, number> = {
  [RiskSeverity.low]: 1,
  [RiskSeverity.medium]: 2,
  [RiskSeverity.high]: 3,
  [RiskSeverity.critical]: 4,
};

export const HOLD_SEVERITIES: readonly RiskSeverity[] = [RiskSeverity.high, RiskSeverity.critical];

export const RiskRule = {
  DocumentReuse: 'document.same_file_other_party',
  PanNameMismatch: 'kyc.pan_name_mismatch',
  ConsistencyDeviation: 'facts.consistency_deviation',
  SharedBankAccount: 'partner.shared_bank_account',
  ReferralBurst: 'partner.referral_code_burst',
} as const;

export const CONSISTENCY_SEVERITY: Partial<Record<string, RiskSeverity>> = {
  medium: RiskSeverity.medium,
  high: RiskSeverity.high,
};

export const GST_ITR_ATTRIBUTE_PATTERN = /gst|itr|tax/;

export const REFERRAL_BURST_THRESHOLD = 20;

export const REFERRAL_BURST_WINDOW_MS = HOUR_MS;

export const RISK_DECISION_NOTE_MAX_LENGTH = 1_000;

export const REVIEW_SIGNALS_LIMIT = 100;
