import { Transactional } from '@nestjs-cls/transactional';
import { Injectable } from '@nestjs/common';

import { ConfigResource } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import { EventName } from '../../../common/events/event-names.js';
import type { Locale } from '../../../common/i18n/locale.js';
import type { RankedLookup } from '../../../engines/facts/resolve-fact.js';
import { matchProducts } from '../../../engines/matching/match-products.js';
import type { ProductMatch } from '../../../engines/matching/matching.types.js';
import type { Prisma } from '../../../generated/prisma/client.js';
import type { AppAbility } from '../../access/domain/ability.types.js';
import { ApplicationPartyService } from '../../applications/application/application-party.service.js';
import { ApplicationService } from '../../applications/application/application.service.js';
import { FactService } from '../../attributes/application/fact.service.js';
import { ChangeRecorder } from '../../audit/application/change-recorder.service.js';
import { AuditAction, AuditEntity } from '../../audit/domain/audit.constants.js';
import { ConfigPublishingService } from '../../config-publishing/application/config-publishing.service.js';
import { DocumentService } from '../../documents/application/document.service.js';
import { LenderCatalogService } from '../../lenders/application/lender-catalog.service.js';
import { LenderService } from '../../lenders/application/lender.service.js';
import { MATCH_DOCUMENT_STAGES } from '../domain/matching.constants.js';
import { MatchingRepository } from '../infrastructure/matching.repository.js';
import { toMatchRunView } from './matching.views.js';

const json = (value: unknown) => value as Prisma.InputJsonValue;

@Injectable()
export class MatchingService {
  constructor(
    private readonly repository: MatchingRepository,
    private readonly applications: ApplicationService,
    private readonly parties: ApplicationPartyService,
    private readonly catalog: LenderCatalogService,
    private readonly lenders: LenderService,
    private readonly config: ConfigPublishingService,
    private readonly facts: FactService,
    private readonly documents: DocumentService,
    private readonly changes: ChangeRecorder,
  ) {}

  async request(applicationId: string, userId: string, ability: AppAbility, locale: Locale) {
    await this.applications.openForChange(applicationId, ability);
    await this.run(applicationId, userId);
    return this.latest(applicationId, ability, locale, false);
  }

  async latest(applicationId: string, ability: AppAbility, locale: Locale, includeIneligible: boolean) {
    await this.applications.get(applicationId, ability);
    const run = await this.repository.latestRun(applicationId);
    if (!run) throw new AppError(ErrorCode.NOT_FOUND, { details: { reason: 'not_matched' } });
    const lenders = await this.lenders.summaries([...new Set(run.results.map((result) => result.lenderId))]);
    return toMatchRunView(run, lenders, locale, includeIneligible);
  }

  async run(applicationId: string, triggeredByUserId: string | null) {
    const subject = await this.applications.matchSubject(applicationId);
    const products = (await this.catalog.liveProducts()).filter((product) => subject.categoryKey === null || product.compiled.category === subject.categoryKey);
    const location = await this.catalog.locate(subject.location);
    const roles = await this.parties.partyIdsByRole(applicationId);
    const lookups = {
      primary: await this.merged(subject.partyId, subject.actingPartyId),
      coApplicants: await Promise.all(roles.coApplicants.map((partyId) => this.facts.rankedLookup(partyId))),
      directors: await Promise.all(roles.directors.map((partyId) => this.facts.rankedLookup(partyId))),
    };
    const outcomes = matchProducts(
      products.map((product) => ({ productDocumentId: product.documentId, productKey: product.key, productVersionId: product.versionId, product: product.compiled })),
      {
        request: { category: subject.categoryKey, segment: subject.segmentKey, subSegment: subject.subSegmentKey, amountPaise: subject.amountPaise, tenureMonths: subject.tenureMonths, location },
        lookups,
        heldDocumentTypes: await this.documents.heldTypes(subject.partyId, applicationId),
        documentStages: MATCH_DOCUMENT_STAGES,
      },
    );
    const names = await this.config.names(ConfigResource.lender_product, outcomes.map((outcome) => outcome.productDocumentId));
    return this.persist(subject.id, subject.latestScoreResultId, location, outcomes, names, triggeredByUserId);
  }

  @Transactional()
  private async persist(applicationId: string, scoreResultId: string | null, request: unknown, outcomes: ProductMatch[], names: Map<string, unknown>, triggeredByUserId: string | null) {
    const eligibleCount = outcomes.filter((outcome) => outcome.outcome === 'eligible').length;
    const run = await this.repository.createRun({ applicationId, scoreResultId, request: json(request), productVersionIds: outcomes.map((outcome) => outcome.productVersionId), eligibleCount, triggeredByUserId });
    if (outcomes.length > 0) {
      await this.repository.createResults(
        outcomes.map((outcome) => ({
          matchRunId: run.id,
          applicationId,
          lenderId: outcome.lenderId,
          productDocumentId: outcome.productDocumentId,
          productVersionId: outcome.productVersionId,
          productKey: outcome.productKey,
          productName: json(names.get(outcome.productDocumentId) ?? { en: outcome.productKey }),
          outcome: outcome.outcome,
          rank: outcome.rank,
          fit: outcome.fit,
          screen: json(outcome.screen),
          hard: json(outcome.eligibility.hard.map(({ traces: _traces, ...rule }) => rule)),
          soft: json(outcome.eligibility.soft.map(({ traces: _traces, ...rule }) => rule)),
          reasons: json(outcome.reasons),
          missingAttributes: outcome.eligibility.missingAttributes,
          documentsNeeded: outcome.documentsNeeded,
        })),
      );
    }
    await this.applications.recordMatch(applicationId, run.id, eligibleCount);
    await this.changes.record({ action: AuditAction.MatchCompleted, entityType: AuditEntity.MatchRun, entityId: run.id, event: EventName.MatchCompleted, metadata: { applicationId, products: outcomes.length, eligibleCount }, payload: { matchRunId: run.id, applicationId, eligibleCount } });
    return run;
  }

  private async merged(partyId: string, actingPartyId: string): Promise<RankedLookup> {
    const own = await this.facts.rankedLookup(partyId);
    if (partyId === actingPartyId) return own;
    const acting = await this.facts.rankedLookup(actingPartyId);
    return (attr) => own(attr) ?? acting(attr);
  }
}
