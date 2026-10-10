type LocalisedText = Record<string, string>;

type Rule = { id: string; when: { attr: string; op: string; value: unknown }; pass?: LocalisedText | null; fail?: LocalisedText | null; weight?: number };

export type LenderProductContent = {
  category: string;
  segments: string[];
  subSegments?: string[];
  amountPaise: { min: number; max: number };
  tenureMonths: { min: number; max: number };
  coverage: { states?: string[]; cityIds?: string[]; nationwide?: boolean; includePincodes?: string[]; excludePincodes?: string[] };
  eligibility: { hard: Rule[]; soft: Rule[] };
  documents: Array<{ key: string; documentTypes: string[]; stage: string }>;
  pricingDisclosure?: LocalisedText;
  [key: string]: unknown;
};

export type LenderProduct = {
  id: string;
  key: string;
  name: LocalisedText;
  versionId: string;
  number: number;
  effectiveFrom: string;
  content: LenderProductContent;
  pendingVersion: { id: string; number: number; status: string } | null;
};

export type LenderProducts = { lender: { id: string; key: string; name: string; status: string }; items: LenderProduct[] };
