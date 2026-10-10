export const DocumentStage = {
  Assessment: 'assessment',
  Submission: 'submission',
  PostSanction: 'post_sanction',
} as const;

export type DocumentStage = (typeof DocumentStage)[keyof typeof DocumentStage];

export const DOCUMENT_KEY_PATTERN = /^[a-z][a-z0-9_]{1,49}$/;

export const DOCUMENT_MAX_SIZE_BYTES = 50 * 1024 * 1024;

export const DOCUMENT_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] as const;

export const DOCUMENT_PERIOD_RULES = ['last_3_months', 'last_6_months', 'last_12_months', 'latest_financial_year', 'latest_assessment_year', 'current'] as const;

export const DocumentTextParam = {
  AssessmentYear: 'assessmentYear',
} as const;

export const DOCUMENT_SLOTS_MAX = 30;

export const DOCUMENT_TYPES_PER_SLOT_MAX = 5;
