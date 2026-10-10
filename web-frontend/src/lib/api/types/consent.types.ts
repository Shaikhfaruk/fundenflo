export type ConsentState = {
  purpose: string;
  label: string;
  granted: boolean;
  everyOrganization: boolean;
  organizationIds: string[];
  excludedOrganizationIds: string[];
  basis: string;
  channel: string;
  lastRecordId: string | null;
  lastChangedAt: string | null;
  expiresAt: string | null;
};

type ConsentTemplateItem = { purpose: string; required: boolean; title: string; summary: string; details: string; textHash: string };

export type ConsentTemplate = { context: string; versionId: string; number: number; locale: string; policyUrl: string | null; items: ConsentTemplateItem[] };

export type ConsentItemInput = { purpose: string; granted: boolean; organizationIds?: string[] };

export type ConsentRecordResult = { consents: ConsentState[]; missingRequired: string[] };

export type ConsentOtpChallenge = { challengeId: string; resendIn: number; expiresIn: number; recipient: string; template: ConsentTemplate };
