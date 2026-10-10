import { defineMachine } from '../define-machine.js';

export const DocumentState = {
  Uploaded: 'uploaded',
  Scanning: 'scanning',
  Scanned: 'scanned',
  Classifying: 'classifying',
  Extracting: 'extracting',
  Verified: 'verified',
  NeedsReview: 'needs_review',
  Rejected: 'rejected',
  Expired: 'expired',
  Deleted: 'deleted',
  Purged: 'purged',
} as const;

export type DocumentState = (typeof DocumentState)[keyof typeof DocumentState];

export const DocumentEvent = {
  StartScan: 'start_scan',
  PassScan: 'pass_scan',
  FailScan: 'fail_scan',
  Classify: 'classify',
  Extract: 'extract',
  Flag: 'flag',
  Verify: 'verify',
  Reject: 'reject',
  Expire: 'expire',
  Delete: 'delete',
  Purge: 'purge',
} as const;

export type DocumentEvent = (typeof DocumentEvent)[keyof typeof DocumentEvent];

const { Uploaded, Scanning, Scanned, Classifying, Extracting, Verified, NeedsReview, Rejected, Expired, Deleted, Purged } = DocumentState;

export const documentMachine = defineMachine<DocumentState, DocumentEvent>({
  name: 'document',
  states: Object.values(DocumentState),
  transitions: {
    start_scan: { from: [Uploaded], to: Scanning },
    pass_scan: { from: [Scanning], to: Scanned },
    fail_scan: { from: [Scanning], to: Rejected },
    classify: { from: [Scanned], to: Classifying },
    extract: { from: [Classifying], to: Extracting },
    flag: { from: [Scanned, Classifying, Extracting], to: NeedsReview },
    verify: { from: [Scanned, Extracting, NeedsReview], to: Verified },
    reject: { from: [Scanned, Classifying, Extracting, NeedsReview, Verified], to: Rejected },
    expire: { from: [Scanned, Verified, NeedsReview], to: Expired },
    delete: { from: [Uploaded, Scanning, Scanned, Classifying, Extracting, Verified, NeedsReview, Rejected, Expired], to: Deleted },
    purge: { from: [Uploaded, Scanning, Scanned, Classifying, Extracting, Verified, NeedsReview, Rejected, Expired, Deleted], to: Purged },
  },
});

export const ACTIVE_DOCUMENT_STATES: readonly DocumentState[] = [Uploaded, Scanning, Scanned, Classifying, Extracting, Verified, NeedsReview];

export const CLEAN_DOCUMENT_STATES: readonly DocumentState[] = [Scanned, Classifying, Extracting, Verified, NeedsReview, Expired];

export const REMOVED_DOCUMENT_STATES: readonly DocumentState[] = [Deleted, Purged];
