import { z } from 'zod';

import { PartnerKind, PartnerLevel } from '../../../common/enums/db.enums.js';
import { type CompiledCommissionScheme, SchemeBase, SchemeBasis, SchemeParty } from '../../../engines/commissions/commissions.types.js';
import { BPS_MAX, DEFAULT_GST_RATE_BPS, DEFAULT_TDS_NO_PAN_RATE_BPS, DEFAULT_TDS_RATE_BPS, SCHEME_SLABS_MAX } from './commission.constants.js';

const key = z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/);

const bps = z.number().int().min(0).max(BPS_MAX);

const paise = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

export const commissionSchemeContentSchema = z
  .object({
    party: z.enum(Object.values(SchemeParty)),
    scope: z
      .object({
        lenders: z.array(key).max(50).default([]),
        categories: z.array(key).max(50).default([]),
        partnerKinds: z.array(z.enum(Object.values(PartnerKind))).default([]),
        partnerLevels: z.array(z.enum(Object.values(PartnerLevel))).default([]),
      })
      .strict()
      .default({ lenders: [], categories: [], partnerKinds: [], partnerLevels: [] }),
    basis: z.enum(Object.values(SchemeBasis)),
    base: z.enum(Object.values(SchemeBase)).default(SchemeBase.Disbursal),
    rateBps: bps.optional(),
    flatPaise: paise.optional(),
    slabs: z.array(z.object({ fromPaise: paise, rateBps: bps }).strict()).max(SCHEME_SLABS_MAX).default([]),
    minPaise: paise.optional(),
    capPaise: paise.optional(),
    gstRateBps: bps.default(DEFAULT_GST_RATE_BPS),
    tdsRateBps: bps.default(DEFAULT_TDS_RATE_BPS),
    tdsNoPanRateBps: bps.default(DEFAULT_TDS_NO_PAN_RATE_BPS),
  })
  .strict()
  .superRefine((scheme, context) => {
    if (scheme.basis === SchemeBasis.Percent && scheme.rateBps === undefined) context.addIssue({ code: 'custom', path: ['rateBps'], message: 'a percent scheme needs rateBps' });
    if (scheme.basis === SchemeBasis.Flat && scheme.flatPaise === undefined) context.addIssue({ code: 'custom', path: ['flatPaise'], message: 'a flat scheme needs flatPaise' });
    if (scheme.basis === SchemeBasis.Slab && scheme.slabs.length === 0) context.addIssue({ code: 'custom', path: ['slabs'], message: 'a slab scheme needs at least one slab' });
    if (scheme.basis === SchemeBasis.Slab && new Set(scheme.slabs.map((slab) => slab.fromPaise)).size !== scheme.slabs.length) context.addIssue({ code: 'custom', path: ['slabs'], message: 'slabs must start at different amounts' });
    if (scheme.party === SchemeParty.Lender && scheme.base !== SchemeBase.Disbursal) context.addIssue({ code: 'custom', path: ['base'], message: 'a lender scheme is based on the disbursal' });
    if (scheme.party === SchemeParty.Lender && (scheme.scope.partnerKinds.length > 0 || scheme.scope.partnerLevels.length > 0)) context.addIssue({ code: 'custom', path: ['scope'], message: 'a lender scheme cannot be scoped to partners' });
    if (scheme.minPaise !== undefined && scheme.capPaise !== undefined && scheme.minPaise > scheme.capPaise) context.addIssue({ code: 'custom', path: ['capPaise'], message: 'the cap must not be below the minimum' });
  });

export type CommissionSchemeContent = z.input<typeof commissionSchemeContentSchema>;

export const toCompiledCommissionScheme = (scheme: z.output<typeof commissionSchemeContentSchema>): CompiledCommissionScheme => ({
  party: scheme.party,
  scope: scheme.scope,
  basis: scheme.basis,
  base: scheme.base,
  rateBps: scheme.rateBps ?? null,
  flatPaise: scheme.flatPaise ?? null,
  slabs: scheme.slabs.toSorted((left, right) => left.fromPaise - right.fromPaise),
  minPaise: scheme.minPaise ?? null,
  capPaise: scheme.capPaise ?? null,
  gstRateBps: scheme.party === SchemeParty.Lender ? scheme.gstRateBps : 0,
  tdsRateBps: scheme.party === SchemeParty.Partner ? scheme.tdsRateBps : 0,
  tdsNoPanRateBps: scheme.party === SchemeParty.Partner ? scheme.tdsNoPanRateBps : 0,
});
