import { AnalysisStatus, DocumentRejectReason, DocumentStatus, LenderKind, SubmissionStatus } from '../../../common/enums/db.enums.js';
import { AnalysisStepState } from '../../assessments/domain/assessment.constants.js';
import { ConsentPurposeKey } from '../../consents/domain/consent.constants.js';

export const COMPAT_QUESTION_KEYS: Readonly<Record<string, string>> = {
  businessAge: 'business_age',
  monthlyTurnover: 'monthly_turnover',
  existingEmis: 'existing_emis',
  gstRegistered: 'gst_registered',
  employment: 'employment',
  monthlyIncome: 'monthly_income',
  workExperience: 'work_experience',
};

export const COMPAT_CONSENT_PURPOSES: Readonly<Record<string, ConsentPurposeKey>> = {
  aiDocuments: ConsentPurposeKey.AiDocuments,
  creditBureau: ConsentPurposeKey.CreditBureau,
  lenderSharing: ConsentPurposeKey.LenderSharing,
};

export const COMPAT_DOCUMENT_TYPES: Readonly<Record<string, string>> = {
  pan: 'pan',
  bankStatement: 'bank_statement',
  itrGst: 'itr',
  itr: 'itr',
  salarySlips: 'salary_slip',
  property: 'property_papers',
  vehicleQuote: 'vehicle_quotation',
  machineryQuote: 'machinery_quotation',
};

export const COMPAT_DEFAULT_SUB_SEGMENTS: Readonly<Partial<Record<string, string>>> = { msme: 'proprietorship' };

export const CompatDocumentStatus = {
  Processing: 'processing',
  Verified: 'verified',
  Rejected: 'rejected',
} as const;

export type CompatDocumentStatus = (typeof CompatDocumentStatus)[keyof typeof CompatDocumentStatus];

export const COMPAT_DOCUMENT_STATUS: Record<DocumentStatus, CompatDocumentStatus> = {
  [DocumentStatus.uploaded]: CompatDocumentStatus.Processing,
  [DocumentStatus.scanning]: CompatDocumentStatus.Processing,
  [DocumentStatus.classifying]: CompatDocumentStatus.Processing,
  [DocumentStatus.extracting]: CompatDocumentStatus.Processing,
  [DocumentStatus.scanned]: CompatDocumentStatus.Verified,
  [DocumentStatus.needs_review]: CompatDocumentStatus.Verified,
  [DocumentStatus.verified]: CompatDocumentStatus.Verified,
  [DocumentStatus.rejected]: CompatDocumentStatus.Rejected,
  [DocumentStatus.expired]: CompatDocumentStatus.Rejected,
  [DocumentStatus.deleted]: CompatDocumentStatus.Rejected,
  [DocumentStatus.purged]: CompatDocumentStatus.Rejected,
};

export const CompatRejection = {
  Expired: 'expired',
  Removed: 'removed',
} as const;

export const COMPAT_REJECT_MESSAGES: Record<DocumentRejectReason | (typeof CompatRejection)[keyof typeof CompatRejection], string> = {
  [DocumentRejectReason.infected]: 'This File Could Not Pass Our Safety Check. Please Upload A Fresh Copy.',
  [DocumentRejectReason.wrong_document]: 'This Does Not Look Like The Document We Asked For. Please Check And Upload Again.',
  [DocumentRejectReason.illegible]: 'We Couldn’t Read This File Clearly. Please Upload A Clearer Copy.',
  [DocumentRejectReason.outdated]: 'This Document Is Too Old. Please Upload A Recent One.',
  [DocumentRejectReason.other]: 'We Couldn’t Use This File. Please Upload It Again.',
  [CompatRejection.Expired]: 'This Document Is Too Old. Please Upload A Recent One.',
  [CompatRejection.Removed]: 'This File Was Removed.',
};

export const CompatAnalysisStatus = {
  Running: 'running',
  Done: 'done',
  Failed: 'failed',
} as const;

export type CompatAnalysisStatus = (typeof CompatAnalysisStatus)[keyof typeof CompatAnalysisStatus];

export const COMPAT_ANALYSIS_STATUS: Record<AnalysisStatus, CompatAnalysisStatus> = {
  [AnalysisStatus.queued]: CompatAnalysisStatus.Running,
  [AnalysisStatus.running]: CompatAnalysisStatus.Running,
  [AnalysisStatus.done]: CompatAnalysisStatus.Done,
  [AnalysisStatus.failed]: CompatAnalysisStatus.Failed,
};

export const COMPAT_STEP_STATE: Record<AnalysisStepState, 'done' | 'active' | 'pending'> = {
  [AnalysisStepState.Pending]: 'pending',
  [AnalysisStepState.Active]: 'active',
  [AnalysisStepState.Done]: 'done',
  [AnalysisStepState.Skipped]: 'done',
  [AnalysisStepState.Failed]: 'pending',
};

export const COMPAT_ANALYSIS_FAILED_MESSAGE = 'We Couldn’t Finish Reading Your Documents. Please Try Again.';

export const COMPAT_UNAVAILABLE_REASON = 'Not Yet Available In Your Area';

export const COMPAT_DEFAULT_INTEREST = 'As Per Lender Policy';

export const COMPAT_LENDER_KIND_LABELS: Record<LenderKind, string> = {
  [LenderKind.bank]: 'Bank',
  [LenderKind.nbfc]: 'NBFC',
  [LenderKind.hfc]: 'Housing Finance Company',
  [LenderKind.small_finance_bank]: 'Small Finance Bank',
  [LenderKind.cooperative_bank]: 'Co-operative Bank',
  [LenderKind.fintech]: 'Fintech Lender',
};

export const CompatApplicationEvent = {
  AnalysisCompleted: 'analysis.completed',
  ApplicationStatus: 'application.status',
} as const;

export const CompatTimelineStep = {
  Documents: 'documents',
  Sent: 'sent',
  Review: 'review',
  Sanctioned: 'sanctioned',
  Disbursed: 'disbursed',
} as const;

export type CompatTimelineStep = (typeof CompatTimelineStep)[keyof typeof CompatTimelineStep];

export const COMPAT_TIMELINE: ReadonlyArray<{ id: CompatTimelineStep; title: string; detail: string }> = [
  { id: CompatTimelineStep.Documents, title: 'Documents Complete', detail: 'Your Uploaded File Is Ready.' },
  { id: CompatTimelineStep.Sent, title: 'Sent To Lender', detail: 'This Lender Has Your File.' },
  { id: CompatTimelineStep.Review, title: 'Under Review', detail: 'The Lender Is Reviewing Your File.' },
  { id: CompatTimelineStep.Sanctioned, title: 'Sanctioned', detail: 'The Lender Approves The Loan.' },
  { id: CompatTimelineStep.Disbursed, title: 'Disbursed', detail: 'Funds Are Sent To Your Account.' },
];

export const COMPAT_TIMELINE_REACHED: Record<SubmissionStatus, number> = {
  [SubmissionStatus.pending_approval]: 1,
  [SubmissionStatus.approved]: 1,
  [SubmissionStatus.sent_to_lender]: 2,
  [SubmissionStatus.under_review]: 2,
  [SubmissionStatus.query_raised]: 2,
  [SubmissionStatus.sanctioned]: 4,
  [SubmissionStatus.disbursed]: 5,
  [SubmissionStatus.rejected]: 3,
  [SubmissionStatus.withdrawn]: 1,
};

export const COMPAT_OPEN_STATUS = 'under_review';

export const COMPAT_FINAL_STATES: ReadonlySet<SubmissionStatus> = new Set([SubmissionStatus.sanctioned, SubmissionStatus.disbursed, SubmissionStatus.rejected, SubmissionStatus.withdrawn]);

export const COMPAT_PENDING_DOCUMENT_DETAIL = 'Upload It In The App To Keep Your Application Moving.';

export const NATIONAL_MOBILE_PREFIX = /^\+91/;
