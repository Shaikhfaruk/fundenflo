type ChecklistDocumentType = {
  key: string;
  label: string | null;
  description: string | null;
  icon: string | null;
  acceptedMimeTypes: string[];
  maxSizeBytes: number;
  periodRule: string | null;
};

type HeldDocument = { id: string; documentType: string; status: string; fileName: string; applicationId: string | null; createdAt: string };

export type ChecklistItem = {
  key: string;
  label: string;
  description: string | null;
  required: boolean;
  minCount: number;
  anyOf: boolean;
  conditional: boolean;
  documentTypes: ChecklistDocumentType[];
  neededBy: string[];
  satisfied: boolean;
  documents: HeldDocument[];
};

export type DocumentChecklist = { stage: string; items: ChecklistItem[] };

export type DocumentView = {
  id: string;
  documentType: { key: string; label: Record<string, string> };
  partyId: string;
  borrowerProfileId: string | null;
  applicationId: string | null;
  source: string;
  status: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  pages: number | null;
  passwordProtected: boolean;
  rejectReason: string | null;
  rejectNote: string | null;
  scannedAt: string | null;
  freshUntil: string | null;
  locked: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type DocumentRequest = {
  id: string;
  applicationId: string;
  submissionId: string | null;
  status: string;
  documentTypes: Array<{ key: string; label: string }>;
  note: string | null;
  requestedContext: string;
  dueAt: string | null;
  fulfilledDocumentIds: string[];
  fulfilledAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
};

export type UploadInput = { file: File; documentType: string; applicationId: string; password?: string };
