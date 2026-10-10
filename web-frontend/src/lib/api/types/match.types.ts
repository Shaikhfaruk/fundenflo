export type MatchItem = {
  id: string;
  rank: number;
  outcome: string;
  fit: number;
  lender: { id: string; key: string | null; name: string | null; organizationId: string | null };
  product: { id: string; key: string; versionId: string; name: string };
  reasons: string[];
  missingAttributes: string[];
  documentsNeeded: string[];
};

export type MatchRun = { id: string; applicationId: string; scoreResultId: string | null; eligibleCount: number; createdAt: string; items: MatchItem[] };
