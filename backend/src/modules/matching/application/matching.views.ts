import { type Locale, localise } from '../../../common/i18n/locale.js';
import type { MatchResult, MatchRun } from '../../../generated/prisma/client.js';

type LenderSummary = { id: string; key: string; name: string };

export const toMatchRunView = (run: MatchRun & { results: MatchResult[] }, lenders: Map<string, LenderSummary>, locale: Locale, includeIneligible: boolean) => ({
  id: run.id,
  applicationId: run.applicationId,
  scoreResultId: run.scoreResultId,
  eligibleCount: run.eligibleCount,
  createdAt: run.createdAt.toISOString(),
  items: run.results
    .filter((result) => includeIneligible || result.outcome !== 'ineligible')
    .map((result) => ({
      id: result.id,
      rank: result.rank,
      outcome: result.outcome,
      fit: result.fit,
      lender: lenders.get(result.lenderId) ?? { id: result.lenderId, key: null, name: null },
      product: { id: result.productDocumentId, key: result.productKey, versionId: result.productVersionId, name: localise(result.productName, locale) },
      reasons: (result.reasons as unknown[]).map((reason) => localise(reason, locale)),
      missingAttributes: result.missingAttributes,
      documentsNeeded: result.documentsNeeded,
      ...(includeIneligible ? { screen: result.screen, hard: result.hard, soft: result.soft } : {}),
    })),
});
