export const DocumentStatus = {
  Uploaded: 'uploaded',
  Scanning: 'scanning',
  Scanned: 'scanned',
  Classifying: 'classifying',
  Extracting: 'extracting',
  Verified: 'verified',
  NeedsReview: 'needs_review',
  Rejected: 'rejected',
  Expired: 'expired',
} as const;

export const PROCESSING_DOCUMENT_STATUSES: readonly string[] = [DocumentStatus.Uploaded, DocumentStatus.Scanning, DocumentStatus.Scanned, DocumentStatus.Classifying, DocumentStatus.Extracting];

export const DocumentRequestStatus = { Open: 'open', Fulfilled: 'fulfilled', Cancelled: 'cancelled' } as const;

export const DOCUMENT_POLL_MS = 3_000;

export const PDF_MIME_TYPE = 'application/pdf';

export const BYTES_PER_KB = 1_024;

export const BYTES_PER_MB = BYTES_PER_KB * BYTES_PER_KB;

export const DEFAULT_DOCUMENT_ICON = 'document';

export const PASSWORD_MAX_LENGTH = 64;

export const MIME_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WEBP',
};

export const IMAGE_MIME_PREFIX = 'image/';
