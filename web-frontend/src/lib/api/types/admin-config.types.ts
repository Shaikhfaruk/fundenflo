export type LocalisedText = Record<string, string>;

type VersionSummary = { id: string; number: number; status: string; effectiveFrom: string | null; publishedAt: string | null; retiredAt: string | null; updatedAt: string };

export type ConfigDocument = {
  id: string;
  resource: string;
  key: string;
  name: LocalisedText;
  description: LocalisedText | null;
  status: string;
  activeVersion: { id: string; number: number; effectiveFrom: string | null } | null;
  openVersion: { id: string; number: number; status: string } | null;
  versions: VersionSummary[];
  version: number;
  createdAt: string;
  updatedAt: string;
};

type ConfigIssue = { path: string; code: string; message: string };

type ChangeRequestSummary = { id: string; status: string; makerUserId: string; checkerUserId: string | null; reason: string; decisionNote: string | null; createdAt: string; decidedAt: string | null };

export type ConfigVersion = {
  id: string;
  resource: string;
  documentId: string;
  documentKey: string;
  number: number;
  status: string;
  content: unknown;
  compiled: unknown;
  issues: ConfigIssue[];
  contentHash: string | null;
  notes: string | null;
  effectiveFrom: string | null;
  publishedAt: string | null;
  retiredAt: string | null;
  createdByUserId: string | null;
  submittedByUserId: string | null;
  approvedByUserId: string | null;
  changeRequest: ChangeRequestSummary | null;
  availableActions: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
};

type DiffChange = { kind: string; path: string; before?: unknown; after?: unknown };

export type ChangeRequest = ChangeRequestSummary & {
  resource: string;
  documentId: string;
  documentKey: string;
  versionId: string;
  versionNumber: number;
  versionStatus: string;
  diff: { changes: DiffChange[]; truncated: boolean; comparedWith: { number: number; versionId: string } | null } | null;
};
