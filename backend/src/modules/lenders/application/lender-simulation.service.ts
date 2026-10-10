import { Injectable } from '@nestjs/common';

import { ConfigResource, FactProvenance } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';
import type { FactValue } from '../../../engines/conditions/condition.types.js';
import type { RankedLookup } from '../../../engines/facts/resolve-fact.js';
import { evaluateProduct } from '../../../engines/lending/evaluate-product.js';
import type { CaseRequest, CompiledLenderProduct } from '../../../engines/lending/lending.types.js';
import { screenProduct } from '../../../engines/lending/screen-product.js';
import { AttributeDictionary } from '../../attributes/application/attribute-dictionary.service.js';
import { FactService } from '../../attributes/application/fact.service.js';
import { type AttributeShape, normaliseFactValue } from '../../attributes/domain/fact-value.js';
import { ConfigPublishingService } from '../../config-publishing/application/config-publishing.service.js';
import type { ConfigIssue } from '../../config-publishing/domain/config.types.js';
import { LenderCatalogService } from './lender-catalog.service.js';
import { LenderProductHandler } from './lender-product.handler.js';

export type SimulationFact = { attribute: string; value: unknown; provenance?: FactProvenance };

export type SimulationProfile = {
  label: string;
  partyId?: string;
  request: { segment: string; subSegment?: string; category?: string; amountPaise?: number; tenureMonths?: number; pincode?: string; cityId?: string };
  facts?: SimulationFact[];
  directors?: SimulationFact[][];
  coApplicants?: SimulationFact[][];
};

type Overlay = Array<{ attributeKey: string; value: FactValue; provenance: FactProvenance }>;

@Injectable()
export class LenderSimulationService {
  constructor(
    private readonly config: ConfigPublishingService,
    private readonly handler: LenderProductHandler,
    private readonly catalog: LenderCatalogService,
    private readonly facts: FactService,
    private readonly dictionary: AttributeDictionary,
  ) {}

  async simulate(documentId: string, number: number, profiles: SimulationProfile[]) {
    const version = await this.config.getVersion(ConfigResource.lender_product, documentId, number);
    const candidate = (version.compiled as CompiledLenderProduct | null) ?? (await this.compileDraft(version.content, version.documentKey));
    const published = (await this.config.active<CompiledLenderProduct>(ConfigResource.lender_product)).find((entry) => entry.documentId === documentId && entry.versionId !== version.id) ?? null;
    const shapes = await this.shapes();
    const results = [];
    for (const [index, profile] of profiles.entries()) {
      const request = await this.request(profile);
      const lookups = {
        primary: await this.facts.rankedLookup(profile.partyId ?? null, this.overlay(profile.facts ?? [], shapes, `profiles.${index}.facts`)),
        directors: await this.parties(profile.directors ?? [], shapes, `profiles.${index}.directors`),
        coApplicants: await this.parties(profile.coApplicants ?? [], shapes, `profiles.${index}.coApplicants`),
      };
      const run = (product: CompiledLenderProduct) => ({ screen: screenProduct(product, request), eligibility: evaluateProduct(product, lookups) });
      const current = run(candidate);
      const before = published ? { number: published.number, ...run(published.compiled) } : null;
      results.push({
        label: profile.label,
        version: { number: version.number, ...current },
        published: before,
        changed: before ? before.screen.outcome !== current.screen.outcome || before.eligibility.eligibility !== current.eligibility.eligibility : null,
      });
    }
    return { documentId, number: version.number, publishedNumber: published?.number ?? null, results };
  }

  private async compileDraft(content: unknown, documentKey: string) {
    const parsed = this.handler.contentSchema.safeParse(content);
    const result = parsed.success ? await this.handler.compile(parsed.data, { documentKey }) : { compiled: null, issues: parsed.error.issues.map((issue) => ({ path: ['content', ...issue.path.map(String)].join('.'), code: issue.code, message: issue.message })) };
    if (!result.compiled) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: result.issues });
    return result.compiled;
  }

  private async request(profile: SimulationProfile): Promise<CaseRequest> {
    return {
      category: profile.request.category ?? null,
      segment: profile.request.segment,
      subSegment: profile.request.subSegment ?? null,
      amountPaise: profile.request.amountPaise ?? null,
      tenureMonths: profile.request.tenureMonths ?? null,
      location: await this.catalog.locate({ pincode: profile.request.pincode, cityId: profile.request.cityId }),
    };
  }

  private async parties(groups: SimulationFact[][], shapes: Map<string, AttributeShape>, path: string): Promise<RankedLookup[]> {
    const lookups: RankedLookup[] = [];
    for (const [index, group] of groups.entries()) lookups.push(await this.facts.rankedLookup(null, this.overlay(group, shapes, `${path}.${index}`)));
    return lookups;
  }

  private overlay(facts: SimulationFact[], shapes: Map<string, AttributeShape>, path: string): Overlay {
    const issues: ConfigIssue[] = [];
    const overlay: Overlay = [];
    for (const [index, fact] of facts.entries()) {
      const shape = shapes.get(fact.attribute);
      const normalised = shape ? normaliseFactValue(shape, fact.value) : null;
      if (!shape) issues.push({ path: `${path}.${index}.attribute`, code: 'unknown_attribute', message: `unknown or inactive attribute ${fact.attribute}` });
      else if (normalised && !normalised.ok) issues.push({ path: `${path}.${index}.value`, code: 'invalid_value', message: normalised.message });
      else if (normalised?.ok) overlay.push({ attributeKey: fact.attribute, value: normalised.value, provenance: fact.provenance ?? FactProvenance.declared });
    }
    if (issues.length > 0) throw new AppError(ErrorCode.VALIDATION_FAILED, { details: issues });
    return overlay;
  }

  private async shapes() {
    return new Map([...(await this.dictionary.active()).values()].map((attribute) => [attribute.key, { dataType: attribute.dataType, enumValues: attribute.enumValues } as AttributeShape]));
  }
}
