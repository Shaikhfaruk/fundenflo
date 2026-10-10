type LocalisedText = Record<string, string>;

export type AdminDocumentType = {
  id: string;
  key: string;
  label: LocalisedText;
  description: LocalisedText | null;
  icon: string | null;
  acceptedMimeTypes: string[];
  maxSizeBytes: number;
  periodRule: string | null;
  freshnessDays: number | null;
  extractorKey: string | null;
  producesAttributes: string[];
  retentionDays: number | null;
  sensitivity: string;
  status: string;
  version: number;
  updatedAt: string;
};

export type AttributeDefinition = {
  id: string;
  key: string;
  label: LocalisedText;
  description: LocalisedText | null;
  dataType: string;
  unit: string | null;
  enumValues: Array<{ value: string; label: LocalisedText }> | null;
  subject: string;
  sensitivity: string;
  allowedProvenance: string[];
  freshnessDays: number | null;
  status: string;
  version: number;
  updatedAt: string;
};

export type AdminPartner = {
  id: string;
  organizationId: string;
  name: string;
  organizationStatus: string;
  kind: string;
  level: string;
  verification: { status: string };
};

type OrganizationRef = { id: string; name: string; type: string; status: string };

export type AdminUser = { id: string; status: string; fullName: string | null; memberships: number; signupChannel: string | null; lastLoginAt: string | null; createdAt: string; version: number };

export type AdminMembership = { id: string; context: string; role: string; status: string; organization: OrganizationRef | null; version: number; createdAt: string };

export type AdminUserDetail = Omit<AdminUser, 'memberships'> & {
  partyId: string | null;
  signupReferralCode: string | null;
  logins: Array<{ id: string; method: string; identifier: string; verifiedAt: string | null; lastUsedAt: string | null }>;
  memberships: AdminMembership[];
  activeSessions: number;
};

export type Invitation = { id: string; organization: OrganizationRef; context: string; role: string; channel: string; recipient: string; status: string; expiresAt: string; acceptedAt: string | null; createdAt: string };

export type AuditEvent = {
  id: string;
  seq: string;
  occurredAt: string;
  actorType: string;
  actorUserId: string | null;
  actorContext: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  requestId: string | null;
  ip: string | null;
  metadata: Record<string, unknown> | null;
  hash: string;
};

export type AuditVerification = { valid: boolean; checked: number; fromSeq: string | null; toSeq: string | null; brokenAt: string | null };

export type ImportBatch = {
  id: string;
  kind: string;
  status: string;
  fileName: string;
  contentType: string;
  sizeBytes: number | null;
  columns: string[] | null;
  sampleRows: Array<Record<string, string>> | null;
  mapping: Record<string, string> | null;
  defaults: Record<string, unknown> | null;
  counts: { total: number; valid: number; invalid: number; committed: number; failed: number; undone: number } | null;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type ImportFields = { kind: string; fields: Array<{ key: string; label: string; description: string }> };

export type ImportRow = { id: string; rowNumber: number; status: string; values: Record<string, string>; issues: { errors: Array<{ code: string; field: string; column: string | null; message: string }>; warnings: Array<{ code: string; message: string }> } | null; entityId: string | null };
