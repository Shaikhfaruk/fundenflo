import { Injectable } from '@nestjs/common';

import { DAY_MS } from '../../../common/constants/time.constants.js';
import type { AttributionKind } from '../../../common/enums/db.enums.js';
import { type PageQuery, pageWindow } from '../../../common/listing/cursor-page.js';
import { InjectConfig } from '../../../config/config.constants.js';
import type { AppConfig } from '../../../config/env.schema.js';
import { LeadAttributionRepository } from '../infrastructure/lead-attribution.repository.js';

@Injectable()
export class LeadAttributionService {
  constructor(
    private readonly attributions: LeadAttributionRepository,
    @InjectConfig() private readonly config: AppConfig,
  ) {}

  create(input: { leadId: string; organizationId: string; kind: AttributionKind; createdByUserId: string }, now = new Date()) {
    return this.attributions.create({ ...input, protectedUntil: new Date(now.getTime() + this.config.PARTNER_REFERRAL_PROTECTION_DAYS * DAY_MS) });
  }

  activeFor(leadIds: string[], now = new Date()) {
    return leadIds.length === 0 ? Promise.resolve([]) : this.attributions.findActive(leadIds, now);
  }

  async listForOrganization(organizationId: string, query: PageQuery) {
    const window = pageWindow(query);
    return { rows: await this.attributions.listForOrganization(organizationId, window.idFilter, window.take), limit: query.limit };
  }
}
