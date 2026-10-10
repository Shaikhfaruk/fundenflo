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
