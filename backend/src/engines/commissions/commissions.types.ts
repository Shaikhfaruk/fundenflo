export const SchemeParty = {
  Lender: 'lender',
  Partner: 'partner',
} as const;

export type SchemeParty = (typeof SchemeParty)[keyof typeof SchemeParty];

export const SchemeBasis = {
  Percent: 'percent',
  Flat: 'flat',
  Slab: 'slab',
} as const;

export type SchemeBasis = (typeof SchemeBasis)[keyof typeof SchemeBasis];

export const SchemeBase = {
  Disbursal: 'disbursal',
  LenderFee: 'lender_fee',
} as const;

export type SchemeBase = (typeof SchemeBase)[keyof typeof SchemeBase];

export type SchemeScope = { lenders: string[]; categories: string[]; partnerKinds: string[]; partnerLevels: string[] };

export type CompiledCommissionScheme = {
  party: SchemeParty;
  scope: SchemeScope;
  basis: SchemeBasis;
  base: SchemeBase;
  rateBps: number | null;
  flatPaise: number | null;
  slabs: Array<{ fromPaise: number; rateBps: number }>;
  minPaise: number | null;
  capPaise: number | null;
  gstRateBps: number;
  tdsRateBps: number;
  tdsNoPanRateBps: number;
};

export type SchemeContext = { lenderKey: string | null; category: string | null; partnerKind: string | null; partnerLevel: string | null };

export const BPS_DENOMINATOR = 10_000n;
