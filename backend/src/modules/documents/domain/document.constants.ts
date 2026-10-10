import { FILE_MIME_TYPES } from '../../../engines/documents/file-signature.js';

export const DocumentStage = {
  Assessment: 'assessment',
  Submission: 'submission',
  PostSanction: 'post_sanction',
} as const;

export type DocumentStage = (typeof DocumentStage)[keyof typeof DocumentStage];

export const DOCUMENT_KEY_PATTERN = /^[a-z][a-z0-9_]{1,49}$/;

export const DOCUMENT_MAX_SIZE_BYTES = 50 * 1024 * 1024;

export const DOCUMENT_MIME_TYPES = FILE_MIME_TYPES;

export const DOCUMENT_PERIOD_RULES = ['last_3_months', 'last_6_months', 'last_12_months', 'latest_financial_year', 'latest_assessment_year', 'current'] as const;

export const DocumentTextParam = {
  AssessmentYear: 'assessmentYear',
} as const;

export const DOCUMENT_SLOTS_MAX = 30;

export const DOCUMENT_TYPES_PER_SLOT_MAX = 5;

export const DOCUMENT_UPLOAD_FIELD = 'file';

export const DOCUMENT_UPLOAD_LIMITS = { fileSize: DOCUMENT_MAX_SIZE_BYTES, files: 1, fields: 8, fieldSize: 2_048, parts: 10 } as const;

export const DOCUMENT_UPLOAD_RATE_LIMIT = { limit: 60, windowSeconds: 3_600 } as const;

export const DOCUMENT_UPLOAD_IP_RATE_LIMIT = { name: 'document-upload', limit: 300, windowSeconds: 3_600 } as const;

export const DOCUMENT_STORAGE_PREFIX = 'documents';

export const DOCUMENT_STORAGE_CONTENT_TYPE = 'application/octet-stream';

export const DOCUMENT_FALLBACK_FILE_NAME = 'document';

export const DOCUMENT_READ_URL_TTL_SECONDS = 300;

export const DOCUMENT_ACTIVE_PER_PARTY_MAX = 200;

export const DOCUMENT_PASSWORD_MAX_LENGTH = 64;

export const DOCUMENT_SCAN_SLA_KIND = 'document_scan';

export const DOCUMENT_SCAN_SLA_MINUTES = 15;

export const DOCUMENT_SCAN_MAX_ATTEMPTS = 6;

export const DOCUMENT_SCAN_CONCURRENCY = 4;

export const DocumentOwnerKind = {
  Application: 'application',
  BorrowerProfile: 'borrower_profile',
  Lender: 'lender',
} as const;

export type DocumentOwnerKind = (typeof DocumentOwnerKind)[keyof typeof DocumentOwnerKind];

export const DOCUMENT_OWNER_METADATA = 'documents:owner';
